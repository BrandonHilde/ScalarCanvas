var MouseDown = false;

// tracks current mouse location
var MouseX = 0;
var MouseY = 0;

// tracks the last mouse down location
var MouseDownX = 0;
var MouseDownY = 0;

// tracks mouse movement for curve drawing
var mousePoints = [];

var ShapeCutoff = 70;

var GraphicsScale = 1;

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

    console.log(pt);

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
        if(currentState == DrawingState.Edit)
        {
            if(EditShape)
            {
                UpdateObject(EditShape.Object, EditShape.Type, MouseX, MouseY);
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
        Builder.RemoveObject(shapeIndex);

        shapeIndex = 0;
    }

    if(ev.key == HotKeys.Color)
    {
        var clr = document.getElementById("clrPicker");

        var forePick = document.getElementById('foreColor');
        var backPick = document.getElementById('backColor');

        forePick.value = foreColor;
        backPick.value = backColor;

        clr.style.display = "block";
    }
    
    if(ev.key == HotKeys.EditMode)
    {
        if(currentState == DrawingState.Edit)
        {
            NextShapeIndex();
        }

        currentState = DrawingState.Edit;
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
}

function OnMouseWheel(ev)
{
    GraphicsScale += ev.deltaY * -0.001;
    GraphicsScale = Math.min(Math.max(0.125, GraphicsScale), 4);
}

function OnDrop(ev)
{
    ev.preventDefault();
    ev.stopPropagation();

    const dt = ev.dataTransfer;
    const files = dt.files;

    handleFiles(files);
}

function setTransformForDrawing(scale)
{
    var matrx = graphics.getTransform();

    matrx.a = scale;
    matrx.d = scale;

    graphics.setTransform(matrx);
}

// MARK: redraw
function ReDraw()
{
    backtexture.Render(graphics);

    setTransformForDrawing(GraphicsScale);
    
    Builder.Build(graphics);
    Builder.RenderAll(graphics);

    setTransformForDrawing(1);

    var circ = new Circle(MouseX, MouseY, 10);
    circ.LineWidth = 1;
    circ.Render(graphics);

    setTransformForDrawing(GraphicsScale);

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

    setTransformForDrawing(1);

    if(currentState == DrawingState.Edit)
    {
        DrawCircles(Builder.objects[shapeIndex], graphics, 5);
    }

        
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

    setTransformForDrawing(GraphicsScale);

    if(grid.Enabled)
    {
        grid.DrawGrid(graphics);
    }

    setTransformForDrawing(1);

    DrawUserHotkeys(graphics);
}

function EndCurve()
{
    //CurrentShape.RemoveLastObject();
    Builder.AddObject(CurrentShape);
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
        }

        if(MirrorActive == MirrorType.Horizontal || MirrorActive == MirrorType.Both)
        {
            var mirrh = MirrorTesth.ReplicateAsMirror(CurrentShape);

            Builder.AddObject(mirrh);

            if(MirrorActive == MirrorType.Both)
            {
                var mirrb = MirrorTestb.ReplicateAsMirror(CurrentShape);

                Builder.AddObject(mirrb);
            }
        }
    }
}

