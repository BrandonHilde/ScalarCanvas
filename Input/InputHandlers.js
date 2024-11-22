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

//temporary - remove later
var MirrorTestv = new MirrorObj(MirrorType.Vertical, 800, 0);
var MirrorTesth = new MirrorObj(MirrorType.Horizontal, 0, 500);
var MirrorTestb = new MirrorObj(MirrorType.Both, 800, 500);

var grid = new Grid(100);

var CurrentShape = null;
var MirrorActive = MirrorType.None;

var EditShape = null;

function OnMouseDown(ev)
{
    MouseDown = true;

    MouseDownX = grid.GetMouseLock(ev.clientX);
    MouseDownY = grid.GetMouseLock(ev.clientY);

    if(currentState == DrawingState.DrawCurve)
    {
        StartCurve(MouseX, MouseY);
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
        Builder.AddObject(CurrentShape);
    }

    if(MirrorActive != MirrorType.None)
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

    CurrentShape = null;
}

function OnMouseMove(ev)
{
    MouseX = grid.GetMouseLock(ev.clientX);
    MouseY = grid.GetMouseLock(ev.clientY);

    ClearCanvas(canvasObj, graphics);

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

}

function OnDrop(ev)
{
    ev.preventDefault();
    ev.stopPropagation();

    const dt = ev.dataTransfer;
    const files = dt.files;

    handleFiles(files);
}

function ReDraw()
{
    Builder.Build();
    Builder.Render(graphics);

    var circ = new Circle(MouseX, MouseY, 10);
    circ.LineWidth = 1;
    circ.Render(graphics);

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

    if(currentState == DrawingState.Edit)
    {
        DrawCircles(Builder.objects[shapeIndex], graphics, 5);
    }

        
    if(MirrorActive != MirrorType.None)
    {
        if(MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Vertical)
        {
            var ln = new Line(MirrorTestv.MirrorX, 0, MirrorTestv.MirrorX, 1000,"#000000");
            ln.LineWidth = 1;
            ln.Render(graphics);
        }
        if(MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Horizontal)
        {
            var lnh = new Line(0, MirrorTesth.MirrorY, 2000, MirrorTesth.MirrorY, 1000,"#000000");
            lnh.LineWidth = 1;
            lnh.Render(graphics);
        }
    }

    DrawUserHotkeys(graphics);
}