var shapeIndex = 0;
var subIndex = 0;

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

function AddNewCurve(x, y, cx, cy, cx2, cy2) 
{
    var crv = new CurveTo(x, y, cx, cy, cx2, cy2);

    CurrentShape.AddObject(crv);
}

function StartCurve(mx, my)
{
    mousePoints = [];
    
    CurrentShape = new PathShape(mx, my);

    CurrentShape.Style = foreColor;

    CurrentShape.LineWidth = LineWidth;
    
    AddNewCurve(mx, my, mx, my, mx, my);
}

function ProccessCurve()
{
    var prev = mousePoints[mousePoints.length - 1];
    var cur = new Point(MouseX, MouseY);

    if(mousePoints.length > 0)
    {
        var dist = MathUtilities.getDistance(prev.x, prev.y, cur.x, cur.y);

        for(v = 0; v < dist; v++)
        {
            mousePoints[mousePoints.length] = cur;
        }
    }
    else
    {
        mousePoints[mousePoints.length] = cur;
    }

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

function NextShapeIndex()
{
    if(Builder)
    {
        shapeIndex++
        shapeIndex %= Builder.objects.length;
    }
}

function GetNearestObject()
{
    var obj = null;

    if(Builder)
    {
        var last = Builder.objects[shapeIndex];

        if(last != null)
        {
            obj = last.GetNearestObject(MouseX, MouseY, 20);
        }
    }

    return obj;
}

function UpdateObject(obj, type, x, y)
{
    if(obj)
    {
        if(obj.AnchoredObjects)
        {
            for(var v = 0; v < obj.AnchoredObjects.length; v++)
            {
                var vrt = MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Vertical;
                var hrt = MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Horizontal;

                var pt = GetDif(obj, type, x, y, vrt, hrt);

                AssignObjValues(obj.AnchoredObjects[v], type, pt.DX, pt.DY, true);
            }
        }

        AssignObjValues(obj, type, x, y);
    }
}

function AssignObjValues(obj, type, x, y, anchor = false)
{
    if(type == PointType.xy)
    {
        if(anchor)
        {
            obj.X -= x;
            obj.Y -= y;
        }
        else
        {
            obj.X = x;
            obj.Y = y;
        }
    }

    if(type == PointType.c)
    {
        if(anchor)
        {
            obj.CX -= x;
            obj.CY -= y;
        }
        else
        {
            obj.CX = x;
            obj.CY = y;
        }
    }

    if(type == PointType.c2)
    {
        if(anchor)
        {
            obj.CX2 -= x;
            obj.CY2 -= y;
        }
        else
        {
            obj.CX2 = x;
            obj.CY2 = y;
        }
    }
}

function GetDif(obj, type, x, y, mirrorx = false, mirrory = false)
{
    var dx = 0;
    var dy = 0;

    if(type == PointType.xy)
    {
        dx = obj.X - x;
        dy = obj.Y - y;
    }

    if(type == PointType.c)
    {
        dx = obj.CX - x;
        dy = obj.CY - y;
    }

    if(type == PointType.c2)
    {
        dx = obj.CX2 - x;
        dy = obj.CY2 - y;
    }

    if(mirrorx) dx *= -1;
    if(mirrory) dy *= -1;

    return {
        DX: dx,
        DY: dy
    };
}

function DrawCircles(obj, graphics, radius)
{
    if(obj != null)
    {
        if(obj.objects)
        {
            for(var v = 0; v < obj.objects.length; v++)
            {
                var sub = obj.objects[v];

                DrawCircleXY(sub, graphics, radius);

                if(sub.ObjType == ObjectType.Curve)
                {
                    DrawCurveXY(sub, graphics, radius);
                }
            }
        }
        else
        {
            DrawCircleXY(obj, graphics, radius);
        }
    }
}

function DrawCircleXY(obj, graphics, radius)
{
    var circ = new Circle(obj.X, obj.Y, radius);

    circ.Render(graphics);
}

function DrawCurveXY(obj, graphics, radius)
{
    var circ1 = new Circle(obj.CX, obj.CY, radius);

    circ1.Render(graphics);

    var circ2 = new Circle(obj.CX2, obj.CY2, radius);

    circ2.Render(graphics);
}