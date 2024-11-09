class PathShape
{
    constructor(x= 0, y = 0)
    {
        this.objects = [];

        this.AddObject(new MoveTo(x, y));
    }

    AddObject(obj)
    {
        this.objects[this.objects.length] = obj;
    }
}

class MoveTo
{
    constructor(x = 0, y = 0)
    {
        this.X = x;
        this.Y = y;
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