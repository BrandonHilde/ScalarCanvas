var MouseDown = false;

// tracks current mouse location
var MouseX = 0;
var MouseY = 0;

// tracks the last mouse down location
var MouseDownX = 0;
var MouseDownY = 0;

// tracks mouse movement for curve drawing
var mousePoints = [];

var ShapeCutoff = 50;
var MoveCount = 0;

var CurrentShape = null;

function OnMouseDown(ev)
{
    MouseDown = true;

    MouseDownX = ev.clientX;
    MouseDownY = ev.clientY;

    if(currentState == DrawingState.DrawCurve)
    {
        StartCurve(MouseDownX, MouseDownY);
    }
}

function OnMouseUp(ev)
{
    MouseDown = false;
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
    }
}

function OnKeyPress(ev)
{
    
}

function OnMouseWheel(ev)
{

}