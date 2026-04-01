var MouseDown = false;
var HideTheCursor = false;

var undoStack = [];

// tracks current mouse location
var MouseX = 0;
var MouseY = 0;

// tracks the last mouse down location
var MouseDownX = 0;
var MouseDownY = 0;

// tracks mouse movement for curve drawing
var mousePoints = [];

var ShapeCutoff = 70;

var LineWidth = 3;

var resizeScale = 10;

var MirrorTestv;
var MirrorTesth;
var MirrorTestb;

var CurrentShape = null;
var MirrorActive = MirrorType.None;

var EditShape = null;

// Bounding box interaction state
var bboxDragState = {
    isDragging: false,
    dragType: null, // 'move', 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
    startX: 0,
    startY: 0,
    startBounds: null,
    originalPoints: null, // Store original point positions for resize
    handleSize: 10
};

const MouseButtons = {
    Left: 0,
    Right: 2,
    Middle: 1
};

function OnMouseDown(ev)
{
    MouseDown = true;

    var pt = grid.GetMouseLock(ev.clientX, ev.clientY);

    MouseDownX = pt.x;
    MouseDownY = pt.y;

    if(currentState == DrawingState.DrawCurve)
    {
        StartCurve(MouseDownX, MouseDownY);
    }

    if(currentState == DrawingState.AddCurve)
    {
        if(CurrentShape)
        {   
            if(ev.button == MouseButtons.Left)
            {
                // Check if clicking near the start of the curve to close it
                if(CurrentShape.objects.length > 0)
                {
                    var startObj = CurrentShape.objects[0];
                    if(startObj.ObjType == ObjectType.Move)
                    {
                        var distToStart = Math.sqrt(
                            Math.pow(MouseX - startObj.X, 2) + 
                            Math.pow(MouseY - startObj.Y, 2)
                        );
                        
                        // If within 20 pixels of start, close the curve
                        if(distToStart < 20 && CurrentShape.objects.length > 2)
                        {
                            // Add a curve segment that connects back to the start
                            var lastCurve = CurrentShape.GetLatestObject();
                            if(lastCurve && lastCurve.ObjType == ObjectType.Curve)
                            {
                                UpdateObject(lastCurve, PointType.xy, startObj.X, startObj.Y);
                            }
                            AddMirror();
                            EndCurve();
                            return;
                        }
                    }
                }
                AddNewCurve(MouseX, MouseY, MouseX, MouseY, MouseX, MouseY);
            }
            else
            {
                AddMirror();
                //console.log(ev.button);
                EndCurve();
            }
        }
        else
        {
            StartCurve(MouseDownX, MouseDownY);
        }
    }

    if(currentState == DrawingState.Move)
    {
        // Check if clicking on bounding box handles or inside the box
        if(Builder.objects[shapeIndex])
        {
            var handle = GetHandleAtPoint(Builder.objects[shapeIndex], MouseX, MouseY, bboxDragState.handleSize);
            
            if(handle)
            {
                bboxDragState.isDragging = true;
                bboxDragState.dragType = handle;
                bboxDragState.startX = MouseX;
                bboxDragState.startY = MouseY;
                bboxDragState.startBounds = Builder.objects[shapeIndex].GetBoundingBox();
                bboxDragState.originalPoints = SaveOriginalPoints(Builder.objects[shapeIndex]);
            }
        }
    }

    if(currentState == DrawingState.Edit)
    {
        EditShape = GetNearestObject();
    }
}

function OnMouseUp(ev)
{
    MouseDown = false;
    
    // Reset bounding box drag state
    if(bboxDragState.isDragging)
    {
        bboxDragState.isDragging = false;
        bboxDragState.dragType = null;
        bboxDragState.startBounds = null;
        bboxDragState.originalPoints = null;
    }

    if(CurrentShape)
    {   
        if(currentState == DrawingState.AddCurve)
        {
            // var last = CurrentShape.GetLatestObject();
            // UpdateObject(last, PointType.xy, MouseX, MouseY);
            // UpdateObject(last, PointType.c2, MouseX, MouseY);

            // AddNewCurve(MouseX, MouseY, MouseX, MouseY, MouseX, MouseY);
        }
        else
        {
            Builder.AddObject(CurrentShape);
            undoStack.push({ action: 'add', object: CurrentShape });
        }
    }

    if(currentState != DrawingState.AddCurve)
    { 
        AddMirror();
        CurrentShape = null;
    };
}

function OnMouseMove(ev)
{
    var pt = grid.GetMouseLock(ev.clientX, ev.clientY);

    var difx = pt.x - MouseX;
    var dify = pt.y - MouseY;

    MouseX = pt.x;
    MouseY = pt.y;

    ClearCanvas(canvasObj, graphics);

    if(CurrentShape)
    {
        if(currentState == DrawingState.AddCurve)
        {
            var last = CurrentShape.GetLatestObject();
            UpdateObject(last, PointType.xy, MouseX, MouseY);
            UpdateObject(last, PointType.c2, MouseX, MouseY);

            CurrentShape.Render(graphics);
        }
    }

    if(MouseDown)
    {
        //MARK: Move Shape
        if(currentState == DrawingState.Move)
        {
            if(bboxDragState.isDragging && Builder.objects[shapeIndex])
            {
                if(bboxDragState.dragType === 'move')
                {
                    MoveShape(Builder.objects[shapeIndex], difx, dify);
                }
                else if(bboxDragState.dragType && bboxDragState.dragType !== 'move')
                {
                    ResizeShape(Builder.objects[shapeIndex], bboxDragState.dragType, bboxDragState.startBounds, MouseX, MouseY, bboxDragState.originalPoints);
                }
            }
        }
        else if(currentState == DrawingState.Edit)
        {
            if(EditShape)
            {
                UpdateObject(EditShape.Object, EditShape.Type, MouseX, MouseY);

                if(EditShape.Object == null)
                {
                    Builder.objects[shapeIndex].MoveShapeBy(difx, dify); 
                }
            }          
        }
        else if(currentState == DrawingState.ResizeMove)
        {
            for(var v = 0; v < Builder.objects.length; v++)
            {
                Builder.objects[v].MoveShapeBy(difx, dify);
            }
        }
    }

    ReDraw();
}

// MARK: keypress
function OnKeyPress(ev)
{
    ClearCanvas(canvasObj, graphics);
    ReDraw();

    if(ev.key == HotKeys.Delete)
    {
        var removed = Builder.RemoveObject(shapeIndex);
        if(removed) undoStack.push({ action: 'delete', object: removed, index: shapeIndex });

        shapeIndex = 0;
    }

    if(ev.key == HotKeys.Color)
    {
        var clr = document.getElementById("menu");

        if(clr.style.display === "block")
        {
            clr.style.display = "none";
        }
        else
        {
            var forePick = document.getElementById('foreColor');
            var backPick = document.getElementById('backColor');

            forePick.value = foreColor;
            backPick.value = backColor;

            clr.style.display = "block";
            UpdateMenu();
        }
    }
    
    if(ev.key == HotKeys.EditMode)
    {
        if(currentState == DrawingState.Edit)
        {
            // Toggle between Points and Curves edit mode
            if(currentEditMode == EditModeType.Points)
            {
                currentEditMode = EditModeType.Curves;
            }
            else
            {
                // Already in Curves mode, so select next shape
                currentEditMode = EditModeType.Points;
                NextShapeIndex();
            }
        }
        else
        {
            // Entering edit mode, default to Points
            currentEditMode = EditModeType.Points;
        }

        currentState = DrawingState.Edit;
    }

    if(ev.key == HotKeys.ResizeMove)
    {
        currentState = DrawingState.ResizeMove;
    }

    if(ev.key == HotKeys.AddCurve)
    {
        if(currentState == DrawingState.AddCurve)
        {
            EndCurve();
        }
        else
        {
            currentState = DrawingState.AddCurve;
        }
    }

    if(ev.key == HotKeys.DrawCurve)
    {
        currentState = DrawingState.DrawCurve;
    }

    if(ev.key == HotKeys.SelectNextShape)
    {
        NextShapeIndex();
    }

    if(ev.key == HotKeys.SaveShapes)
    {      
        var box = Builder.GetBoundingBox();
        var svg =  SaveSVG(Builder, box.Width, box.Height);

        SaveToRawText(svg);
    }

    if(ev.key == HotKeys.MoveShape)
    {
       currentState = DrawingState.Move;
       UpdateCursorForMode();
    }

    if(ev.key == HotKeys.CopyShape)
    {
        var shp = Builder.objects[shapeIndex];

        if(shp.ObjType == ObjectType.Path)
        {
            var dup = shp.DuplicateAt(MouseX, MouseY);
            Builder.AddObject(dup);
            undoStack.push({ action: 'add', object: dup });
        }
    }

    if(ev.key == HotKeys.HideCursor)
    {
        HideTheCursor = !HideTheCursor;

        if(HideTheCursor)
            canvasObj.style.cursor = "none";
        else  canvasObj.style.cursor = "default";
    }

    if(ev.key == HotKeys.Mirror)
    {
        if(MirrorActive == MirrorType.None)
        {
            MirrorActive = MirrorType.Vertical;
        }
        else if(MirrorActive == MirrorType.Vertical)
        {
            MirrorActive = MirrorType.Horizontal;
        }
        else if(MirrorActive == MirrorType.Horizontal)
        {
            MirrorActive = MirrorType.Both;
        }
        else{
            MirrorActive = MirrorType.None;
        }
    }

    if(ev.key == HotKeys.Grid)
    {
        grid.Enabled = !grid.Enabled;
    }

    UpdateCursorForMode();
}

function OnMouseWheel(ev)
{
    if(currentState == DrawingState.Edit)
    {
        ResizeSingle(ev);
    }
    else if(currentState == DrawingState.ResizeMove)
    {
        ResizeAll(ev);
    }

    ClearCanvas(canvasObj, graphics);
    ReDraw();
}
//MARK: on drop
function OnDrop(ev)
{
    ev.preventDefault();
    ev.stopPropagation();

    const dt = ev.dataTransfer;
    const files = dt.files;

    handleFiles(files);

    handleFileSVG(files);
}

//MARK: resize

function ResizeSingle(ev)
{
    var shp = Builder.objects[shapeIndex];

    if(ev.deltaY > 0)
    {
        shp.Resize(resizeScale, resizeScale, shp.GetBoundingBox());
    }
    else
    {
        shp.Resize(-resizeScale, -resizeScale, shp.GetBoundingBox());
    }
}

function ResizeAll(ev)
{
    for(var v = 0; v < Builder.objects.length; v++)
    {
        var shp = Builder.objects[v];

        if(ev.deltaY > 0)
        {
            shp.Resize(resizeScale, resizeScale, Builder.GetBoundingBox());
        }
        else
        {
            shp.Resize(-resizeScale, -resizeScale, Builder.GetBoundingBox());
        }
    }
}

function highlightSegment(pathI, objI)
{
    if(Builder.objects)
    {

        if(Builder.objects[pathI].objects[objI])
        {
            Builder.objects[pathI].objects[objI].Highlight = true;
        }
    }
   
}

function DrawCursor()
{
    var circ = new Circle(MouseX, MouseY, 10);
    circ.LineWidth = 1;
    circ.Render(graphics);
}

// MARK: redraw
function ReDraw()
{
    backtexture.Render(graphics);

    Builder.Build(graphics);
    Builder.RenderAll(graphics);

    DrawCursor();

    if(!MirrorTestb)
    {
        var w = canvasWidth;
        var h = canvasHeight;

        MirrorTestv = new MirrorObj(MirrorType.Vertical, w/2, 0);
        MirrorTesth = new MirrorObj(MirrorType.Horizontal, 0, h/2);
        MirrorTestb = new MirrorObj(MirrorType.Both, w/2, h/2);
    }

    if(MouseDown)
    {
        // tracks shape created with the mouse for DrawCurve
        if(currentState == DrawingState.DrawCurve)
        {
            if(CurrentShape)
            {
                ProccessCurve();
                CurrentShape.Render(graphics);
            }
            
        }
    }

    if(currentState == DrawingState.AddCurve)
    {
        if(CurrentShape != null)
        {
            CurrentShape.Render(graphics);
            
            // Draw visual indicator when near start point
            if(CurrentShape.objects.length > 2)
            {
                var startObj = CurrentShape.objects[0];
                if(startObj.ObjType == ObjectType.Move)
                {
                    var distToStart = Math.sqrt(
                        Math.pow(MouseX - startObj.X, 2) + 
                        Math.pow(MouseY - startObj.Y, 2)
                    );
                    
                    if(distToStart < 20)
                    {
                        // Draw a highlight circle around the start point
                        graphics.beginPath();
                        graphics.arc(startObj.X, startObj.Y, 12, 0, Math.PI * 2);
                        graphics.strokeStyle = '#64ffda';
                        graphics.lineWidth = 2;
                        graphics.setLineDash([5, 5]);
                        graphics.stroke();
                        graphics.setLineDash([]);
                        
                        // Draw a smaller solid circle
                        graphics.beginPath();
                        graphics.arc(startObj.X, startObj.Y, 6, 0, Math.PI * 2);
                        graphics.fillStyle = 'rgba(100, 255, 218, 0.3)';
                        graphics.fill();
                        graphics.strokeStyle = '#64ffda';
                        graphics.lineWidth = 2;
                        graphics.stroke();
                    }
                }
            }
        }
    }

    if(currentState == DrawingState.Edit)
    {
        DrawCircles(Builder.objects[shapeIndex], graphics, 5, currentEditMode);
    }
    
    if(currentState == DrawingState.Move)
    {
        if(Builder.objects[shapeIndex])
        {
            DrawBoundingBox(Builder.objects[shapeIndex], graphics, bboxDragState.handleSize);
        }
    }

    if(MirrorActive != MirrorType.None)
    {
        if(MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Vertical)
        {
            var ln = new Line(MirrorTestv.MirrorX, 0, MirrorTestv.MirrorX, canvasHeight, aidColor);
            ln.LineWidth = 1;
            ln.Render(graphics);
        }
        if(MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Horizontal)
        {
            var lnh = new Line(0, MirrorTesth.MirrorY, canvasWidth, MirrorTesth.MirrorY, aidColor);
            lnh.LineWidth = 1;
            lnh.Render(graphics);
        }
    }

    if(grid.Enabled)
    {
        grid.DrawGrid(graphics);
    }

    UpdateToolbar();
    UpdateStatusBar();

    if(mousePoints.length > 2)
    {
        var ln = new LineOfPoints(mousePoints, "#FFFFFF");

        ln.Render(graphics);
    }
}

function EndCurve()
{
    //CurrentShape.RemoveLastObject();
    Builder.AddObject(CurrentShape);
    undoStack.push({ action: 'add', object: CurrentShape });
    CurrentShape = null;
}

function AddMirror()
{
    if(MirrorActive != MirrorType.None && CurrentShape)
    {
        if(MirrorActive == MirrorType.Vertical || MirrorActive == MirrorType.Both)
        {
            var mirrv = MirrorTestv.ReplicateAsMirror(CurrentShape);

            Builder.AddObject(mirrv);
            undoStack.push({ action: 'add', object: mirrv });
        }

        if(MirrorActive == MirrorType.Horizontal || MirrorActive == MirrorType.Both)
        {
            var mirrh = MirrorTesth.ReplicateAsMirror(CurrentShape);

            Builder.AddObject(mirrh);
            undoStack.push({ action: 'add', object: mirrh });

            if(MirrorActive == MirrorType.Both)
            {
                var mirrb = MirrorTestb.ReplicateAsMirror(CurrentShape);

                Builder.AddObject(mirrb);
                undoStack.push({ action: 'add', object: mirrb });
            }
        }
    }
}

//MARK: update menu
function UpdateMenu()
{
    var lst = document.getElementById("shapelist");

    var temp = "";

    for(var v = 0; v < Builder.objects.length; v++)
    {
        temp += '<div ';
        
        if(v == shapeIndex)
        {
            temp +='class="objShape objSelect" ';
        }
        else
        {
             temp +='class="objShape objNotSelect" ';
        }

        var del =  "Builder.RemoveObject(" + v + "); UpdateMenu();";

        temp += '><span>' + Builder.objects[v].ObjType 
        + '<span><span style="float:right; cursor:pointer;" onclick="'
        + del
        + '">x</span>';
        
        temp += '</div>';

        var objs = Builder.objects[v].objects;

        for(var m = 0; m < objs.length; m++)
        {
            var del =  "Builder.RemoveSubObject(" + v + ", " + m +"); UpdateMenu();";

            if(objs[m].ObjType == ObjectType.Move)
            {

            }
            else
            {
                temp += '<div>';

                temp += '<span class="highlight">' + objs[m].ObjType 
                + '<span><span style="float:right;cursor:pointer;" ' 
                + 'onmouseenter="highlightSegment(' + v + ',' + m +');" ' 
                + 'onclick="'
                + del
                + '">x</span>';

                temp += '</div>';
            }
        }
    }

    lst.innerHTML = temp;
}

function UpdateCursorForMode()
{
    if(HideTheCursor) return;

    if(currentState == DrawingState.DrawCurve || currentState == DrawingState.AddCurve)
        canvasObj.style.cursor = 'crosshair';
    else if(currentState == DrawingState.ResizeMove)
        canvasObj.style.cursor = 'move';
    else if(currentState == DrawingState.Move)
    {
        // Check if hovering over bounding box handles
        if(Builder.objects[shapeIndex] && !MouseDown)
        {
            var handle = GetHandleAtPoint(Builder.objects[shapeIndex], MouseX, MouseY, bboxDragState.handleSize);
            
            if(handle === 'move')
                canvasObj.style.cursor = 'move';
            else if(handle === 'nw' || handle === 'se')
                canvasObj.style.cursor = 'nwse-resize';
            else if(handle === 'ne' || handle === 'sw')
                canvasObj.style.cursor = 'nwse-resize';
            else if(handle === 'n' || handle === 's')
                canvasObj.style.cursor = 'ns-resize';
            else if(handle === 'e' || handle === 'w')
                canvasObj.style.cursor = 'ew-resize';
            else
                canvasObj.style.cursor = 'default';
        }
        else
        {
            canvasObj.style.cursor = 'default';
        }
    }
    else if(currentState == DrawingState.Edit)
    {
        canvasObj.style.cursor = 'pointer';
    }
    else
        canvasObj.style.cursor = 'default';
}

function Undo()
{
    if(undoStack.length == 0) return;

    var entry = undoStack.pop();

    if(entry.action == 'add')
    {
        var idx = Builder.objects.indexOf(entry.object);
        if(idx > -1) Builder.RemoveObject(idx);
    }
    else if(entry.action == 'delete')
    {
        Builder.objects.splice(entry.index, 0, entry.object);
    }

    shapeIndex = Math.min(shapeIndex, Math.max(0, Builder.objects.length - 1));

    ClearCanvas(canvasObj, graphics);
    ReDraw();
}

