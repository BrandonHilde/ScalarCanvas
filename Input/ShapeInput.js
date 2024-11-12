function UpdateCurve(x, y) {
    if (mousePoints.length > 0) {
        var num1 = parseInt(mousePoints.length / 4);
        var num2 = num1 * 3;

        var two = mousePoints[num1];
        var three = mousePoints[num2];

        var ctrlMid = MathUtilities.getPointAlongLine(0.25, mousePoints[0], mousePoints[mousePoints.length - 1]);
        var ctrlLeft = MathUtilities.getPointAlongLine(2, ctrlMid, two);

        var ctrlFar = MathUtilities.getPointAlongLine(0.75, mousePoints[0], mousePoints[mousePoints.length - 1]);
        var ctrlRight = MathUtilities.getPointAlongLine(2, ctrlFar, three);

        var crv = CurrentShape.GetLatestObject();

        crv.X = x;
        crv.Y = y;
        crv.CX = ctrlLeft.x;
        crv.CY = ctrlLeft.y;
        crv.CX2 = ctrlRight.x;
        crv.CY2 = ctrlRight.y;
    }
}

function AddNewCurve(x, y, cx, cy, cx2, cy2) {
    CurrentShape.AddObject(new CurveTo(x, y, cx, cy, cx2, cy2));
}

function StartCurve(mx_down, my_down)
{
    CurrentShape = new PathShape(mx_down, my_down);
    AddNewCurve(mx_down, my_down, mx_down, my_down, mx_down, my_down);
}

function ProccessCurve()
{
    mousePoints[mousePoints.length] = new Point(MouseX, MouseY);

    if(CurrentShape)
    {
        var last = CurrentShape.GetLatestObject();

         last.X = MouseX;
         last.Y = MouseY;

        if (MoveCount++ > ShapeCutoff) 
        {
            AddNewCurve(MouseX, MouseY, MouseDownX, MouseDownY, MouseX, MouseY);

            MoveCount = 0;
            mousePoints = [];
        }

        UpdateCurve(MouseX, MouseY);
    }
}