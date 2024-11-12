const PointType = {
    xy:"xy",
    xy2:"xy2",
    c: "c",
    c2: "c2"
};

function UpdateCurve(x, y) {
    if (mousePoints.length > 4) {
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

function StartCurve(mx, my)
{
    mousePoints = [];
    CurrentShape = new PathShape(mx, my);
    AddNewCurve(mx, my, mx, my, mx, my);
}

function ProccessCurve()
{
    mousePoints[mousePoints.length] = new Point(MouseX, MouseY);

    if(CurrentShape)
    {
        var last = CurrentShape.GetLatestObject();

         last.X = MouseX;
         last.Y = MouseY;

        if (mousePoints.length > ShapeCutoff) 
        {
            AddNewCurve(MouseX, MouseY, MouseX, MouseY, MouseX, MouseY);

            MoveCount = 0;
            mousePoints = [];
        }

        UpdateCurve(MouseX, MouseY);
    }
}

function GetNearestObject()
{
    var obj = null;

    if(Builder)
    {
        var last = Builder.GetLatestObject();

        obj = last.GetNearestObject(MouseX, MouseY, 20);
    }


    return obj;
}

function UpdateObject(obj, type, x, y)
{
    if(type == PointType.xy)
    {
        obj.X = x;
        obj.Y = y;
    }

    if(type == PointType.c)
    {
        obj.CX = x;
        obj.CY = y;
    }

    if(type == PointType.c2)
    {
        obj.CX2 = x;
        obj.CY2 = y;
    }
}

function DrawCircles(obj, graphics, radius)
{
    for(var v = 0; v < obj.objects.length; v++)
    {
        var sub = obj.objects[v];

        var circ = new Circle(sub.X, sub.Y, radius);

        circ.Render(graphics);

        if(sub.ObjType == ObjectType.Curve)
        {
            var circ1 = new Circle(sub.CX, sub.CY, radius);

            circ1.Render(graphics);

            var circ2 = new Circle(sub.CX2, sub.CY2, radius);

            circ2.Render(graphics);
        }
    }
}