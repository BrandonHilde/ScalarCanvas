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
        console.log(EditShape);
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
        // tracks shape created with the mouse for DrawCurve
        if(currentState == DrawingState.DrawCurve)
        {
            if(CurrentShape)
            {
                ProccessCurve();
                CurrentShape.Render(graphics);
            }
            
        }

        if(currentState == DrawingState.Edit)
        {
            if(EditShape)
            {
                UpdateObject(EditShape.Object, EditShape.Type, MouseX, MouseY);
            }
        }
    }

    if(currentState == DrawingState.Edit)
    {
        DrawCircles(Builder.GetLatestObject(), graphics, 10);
    }

    DrawUserHotkeys(graphics);
}

function OnKeyPress(ev)
{
    if(ev.key == HotKeys.EditMode)
    {
        currentState = DrawingState.Edit;
    }

    if(ev.key == HotKeys.AddCurve)
    {
        currentState = DrawingState.DrawCurve;
    }

    if(ev.key == HotKeys.SelectNextShape)
    {

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