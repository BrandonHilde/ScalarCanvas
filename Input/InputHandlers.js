var MouseDown = false;
var MouseX = 0;
var MouseY = 0;

var MouseDownX = 0;
var MouseDownY = 0;

var mousePoints = [];

function OnMouseDown(ev)
{
    MouseDown = true;

    MouseDownX = ev.clientX;
    MouseDownY = ev.clientY;
}

function OnMouseUp(ev)
{
    MouseDown = false;
}

function OnMouseMove(ev)
{
    MouseX = ev.clientX;
    MouseY = ev.clientY;

    if(MouseDown)
    {
        if(currentState == DrawingState.DrawCurve)
        {
            mousePoints[mousePoints.length] = new Point(MouseX, MouseY);
        }
    }
}

function OnKeyPress(ev)
{
    
}