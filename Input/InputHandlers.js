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

var CurrentShape = null;

var EditShape = null;

function OnMouseDown(ev)
{
    MouseDown = true;

    MouseDownX = ev.clientX;
    MouseDownY = ev.clientY;

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

    CurrentShape = null;
}

function OnMouseMove(ev)
{
    MouseX = ev.clientX;
    MouseY = ev.clientY;

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
        var svg =  SaveSVG(Builder, 1000, 1000);
        SaveToRawText(svg);
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

    DrawUserHotkeys(graphics);
}