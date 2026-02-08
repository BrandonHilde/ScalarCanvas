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

var GraphicsScale = 1;
var resizeScale = 10;

//temporary - remove later
var MirrorTestv;
var MirrorTesth;
var MirrorTestb;

var CurrentShape = null;
var MirrorActive = MirrorType.None;

var EditShape = null;

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

    if(currentState == DrawingState.Edit)
    {
        EditShape = GetNearestObject();    
    }
}

function OnMouseUp(ev)
{
    MouseDown = false;

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
        if(currentState == DrawingState.Edit)
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

        var forePick = document.getElementById('foreColor');
        var backPick = document.getElementById('backColor');

        forePick.value = foreColor;
        backPick.value = backColor;

        clr.style.display = "block";

        UpdateMenu();
    }
    
    if(ev.key == HotKeys.EditMode)
    {
        if(currentState == DrawingState.Edit)
        {
            NextShapeIndex();
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
       var shp = Builder.objects[shapeIndex];

       // var bx = shp.GetBoundingBox();

       // bx.Render(graphics);

       shp.MoveShapeToCenter(MouseX, MouseY);
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

//MARK: Scale
function SetScale(ev)
{
    var gscale = GraphicsScale;

    gscale += ev.deltaY * -0.0012;
    gscale = Math.min(Math.max(0.2, gscale), 4);

    gscale *= 10;
    gscale = parseInt(gscale);

    GraphicsScale = gscale / 10;
}

function OnMouseWheel(ev)
{
    //SetScale(ev);

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

// MARK: Set Transform
// function setTransformForDrawingDepricated(scale)
// {
//     var matrx = graphics.getTransform();

//     matrx.a = scale;
//     matrx.d = scale;

//     var vw = canvasWidth * scale;
//     var vh = canvasHeight * scale;

//     var difh = canvasHeight - vh;
//     var difw = canvasWidth - vw;

//     matrx.e = difw / 2; // horizontal
//     matrx.f = difh / 2; // vertical

//     graphics.setTransform(matrx);
// }

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

    //setTransformForDrawing(GraphicsScale);
    
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
        }
    }

    if(currentState == DrawingState.Edit)
    {
        DrawCircles(Builder.objects[shapeIndex], graphics, 5);
    }

    //setTransformForDrawing(1);
        
    if(MirrorActive != MirrorType.None)
    {
        if(MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Vertical)
        {
            var ln = new Line(MirrorTestv.MirrorX, 0, MirrorTestv.MirrorX, 1000, aidColor);
            ln.LineWidth = 1;
            ln.Render(graphics);
        }
        if(MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Horizontal)
        {
            var lnh = new Line(0, MirrorTesth.MirrorY, 2000, MirrorTesth.MirrorY, aidColor);
            lnh.LineWidth = 1;
            lnh.Render(graphics);
        }
    }

    //setTransformForDrawing(GraphicsScale);

    if(grid.Enabled)
    {
        grid.DrawGrid(graphics);
    }

    //setTransformForDrawing(1);

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
    else if(currentState == DrawingState.Move || currentState == DrawingState.ResizeMove)
        canvasObj.style.cursor = 'move';
    else if(currentState == DrawingState.Edit)
        canvasObj.style.cursor = 'pointer';
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

