const ObjectType = {
    Path: "path",
    Curve: "curve",
    Circle: "circle",
    Line: "line",
    Move: "move",
    Rectangle: "rect"
}

class PathShape
{
    constructor(x= 0, y = 0)
    {
        this.objects = [];

        this.ObjType = ObjectType.Path;

        this.Style = "#FFFF00";

        this.AddObject(new MoveTo(x, y));
    }

    AddObject(obj)
    {
        this.objects[this.objects.length] = obj;
    }

    GetLatestObject()
    {
        return this.objects[this.objects.length - 1];
    }

    GetNearestObject(x, y, maxDist = 100)
    {
        var cdist = maxDist + 100;
        var typ = null;

        var obj = null;

        for(var v = 0; v < this.objects.length; v++)
        {
            if(this.objects[v].X)
            {
                var dist = MathUtilities.getDistance(this.objects[v].X, this.objects[v].Y, x, y);

                if(dist < cdist)
                {
                    cdist = dist;

                    obj = this.objects[v];
                    typ = PointType.xy;
                }
            }

            if(this.objects[v].CX)
            {
                var dist = MathUtilities.getDistance(this.objects[v].CX, this.objects[v].CY, x, y);

                if(dist < cdist)
                {
                    cdist = dist;

                    obj = this.objects[v];
                    typ = PointType.c;
                }
            }

            if(this.objects[v].CX2)
            {
                var dist = MathUtilities.getDistance(this.objects[v].CX2, this.objects[v].CY2, x, y);

                if(dist < cdist)
                {
                    cdist = dist;

                    obj = this.objects[v];
                    typ = PointType.c2;
                }
            }
        }

        return {
            Object: obj,
            Type: typ
        };
    }

    Render(canvas)
    {
        canvas.strokeStyle = this.Style;

		for(var v = 0; v < this.objects.length; v++)
        {
            this.objects[v].Render(canvas);
        }

        canvas.stroke();
        canvas.beginPath();
    }
}

class MoveTo
{
    constructor(x = 0, y = 0)
    {
        this.X = x;
        this.Y = y;

        this.ObjType = ObjectType.Move;
    }

    Build()
    {

    }

    Render(canvas)
    {
        canvas.strokeStyle = this.Style;
		canvas.moveTo(this.X, this.Y);
    }

    GetSvgData()
    {
        return "M" + this.X + " " + this.Y;
    }
}

class CurveTo
{
    constructor(x, y, cx, cy, cx2, cy2)
    {
        this.X = x;
        this.Y = y;
        this.CX = cx;
        this.CY = cy;
        this.CX2 = cx2;
        this.CY2 = cy2;

        this.Style = "#99FF99";
        this.LineWidth = 3;

        this.ObjType = ObjectType.Curve;
    }

    Build()
    {

    }

    Render(canvas)
    {
        canvas.strokeStyle = this.Style;
        canvas.lineWidth = this.LineWidth;
		canvas.bezierCurveTo(this.CX, this.CY, this.CX2, this.CY2, this.X, this.Y);
    }

    GetSvgData()
    {
        return "C" + this.CX + " " + this.CY + " " + this.CX2 + " " + this.CY2 + " " + this.X + " " + this.Y;
    }
}

class Circle
{
    constructor(x, y, radius)
    {
        this.X = x;
        this.Y = y;
        this.Radius = radius;

        this.Style = "#99FF99";
        this.LineWidth = 3;

        this.ObjType = ObjectType.Circle;
    }

    Build()
    {

    }

    Render(canvas)
    {
        canvas.strokeStyle = this.Style;
        canvas.lineWidth = this.LineWidth;

        canvas.beginPath();
        canvas.arc(
            this.X, this.Y, 
            this.Radius,
            0, 
            Math.PI * 2,
            false);	

        canvas.stroke();
    }
}