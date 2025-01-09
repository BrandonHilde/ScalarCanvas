const ObjectType = {
    Path: "path",
    Curve: "curve",
    Circle: "circle",
    Line: "line",
    Move: "move",
    Rectangle: "rect",
    Image: "image",
    TextureRepeat: "texture"
}

class PathShape
{
    constructor(x= 0, y = 0)
    {
        this.objects = [];

        this.ObjType = ObjectType.Path;

        this.Style = "#FFFF00";
        this.Fill = "#00000000";
        this.LineWidth = 3;

        this.AddObject(new MoveTo(x, y));
    }

    GetBoundingBox()
    {
        var bounds = new BoundingBox(-1,-1,-1,-1);

        for(var v = 0; v < this.objects.length; v++)
        {
            var objB = this.objects[v].GetBoundingBox();

            //TODO: make sure it takes not greatest width but greatest width between points

            if(bounds.X < 0) bounds.X = objB.X;
            else if(bounds.X > objB.X) bounds.X = objB.X;

            if(bounds.Y < 0) bounds.Y = objB.Y;
            else if(bounds.Y > objB.Y) bounds.Y = objB.Y;

            if(bounds.Width < 0) bounds.Width = objB.Width;
            else if(bounds.Width < objB.Width) bounds.Width = objB.Width;

            if(bounds.Height < 0) bounds.Height = objB.Height;
            else if(bounds.Height < objB.Height) bounds.Height = objB.Height;
        }

        return bounds;
    }

    MoveShapeToCenter(x, y)
    {
        var bounds = this.GetBoundingBox();

        var centx = bounds.X + (bounds.Width  / 2);
        var centy = bounds.Y + (bounds.Height / 2);

        console.log(bounds);

        var difx = x - centx;
        var dify = y - centy;

        console.log(difx + " " + dify);

        for(var v = 0; v < this.objects.length; v++)
        {
            if(this.objects[v].X)
            {
                this.objects[v].X += difx;
                this.objects[v].Y += dify;
            }

            if(this.objects[v].CX)
            {
                this.objects[v].CX += difx;
                this.objects[v].CY += dify;
            }

            if(this.objects[v].CX2)
            {
                this.objects[v].CX2 += difx;
                this.objects[v].CY2 += dify;
            }
        }
    }

    RemoveLastObject()
    {
        this.objects.pop();
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

    Build(canvas)
    {
        canvas.beginPath();
        
        for(var v = 0; v < this.objects.length; v++)
        {
            this.objects[v].Build(canvas);
        }

        canvas.strokeStyle = this.Style;
        canvas.fillStyle = this.Fill;
        canvas.lineWidth = this.LineWidth;
    }

    Render(canvas)
    {
        this.Build(canvas);

        canvas.fill();
        canvas.stroke();

        canvas.beginPath();
    }

    GetSvgData()
    {
        var text = "";

        for(var v = 0; v < this.objects.length; v++)
        {
            text += this.objects[v].GetSvgData();
        }

        return text;
    }
}

class MoveTo
{
    constructor(x = 0, y = 0)
    {
        this.X = x;
        this.Y = y;

        this.AnchoredObjects = [];

        this.ObjType = ObjectType.Move;
    }

    GetBoundingBox()
    {
        return new BoundingBox(this.X, this.Y, 1,1);
    }

    AddAnchor(obj)
    {
        this.AnchoredObjects[this.AnchoredObjects.length] = obj;
    }

    Build(canvas)
    {
		canvas.moveTo(this.X, this.Y);
    }

    Render(canvas)
    {
        this.Build(canvas);
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

        this.AnchoredObjects = [];

        this.ObjType = ObjectType.Curve;
    }

    AddAnchor(obj)
    {
        this.AnchoredObjects[this.AnchoredObjects.length] = obj;
    }

    Build(canvas)
    {
		canvas.bezierCurveTo(this.CX, this.CY, this.CX2, this.CY2, this.X, this.Y);
    }

    GetBoundingBox()
    {
        var x = 999999999;
        var y = 999999999;
        var w = -1;
        var h = -1;

        if(this.X < x) x = this.X;
        if(this.X > w) w = this.X;

        if(this.Y < y) y = this.Y;
        if(this.Y > h) h = this.Y;

        //c
        if(this.CX < x) x = this.CX;
        if(this.CX > w) w = this.CX;

        if(this.CY < y) y = this.CY;
        if(this.CY > h) h = this.CY;

        //c2
        if(this.CX2 < x) x = this.CX2;
        if(this.CX2 > w) w = this.CX2;

        if(this.CY2 < y) y = this.CY2;
        if(this.CY2 > h) h = this.CY2;

        var bndbx = new BoundingBox(x, y, w - x, h - y);

        console.log(w + " " + h);

        console.log(bndbx);

        return bndbx;
    }

    Render(canvas)
    {
        this.Build(canvas);

        canvas.stroke();
        canvas.fill();
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

    Build(canvas)
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
    }

    Render(canvas)
    {    
        this.Build(canvas);
        
        canvas.stroke();
        canvas.fill();
    }
}

class Line
{
    constructor(x, y, x2, y2, style = "#99FF99")
    {
        this.X = x;
        this.Y = y;
        this.X2 = x2;
        this.Y2 = y2;

        this.Style = style;
        this.LineWidth = 3;

        this.ObjType = ObjectType.Line;
    }

    Build(canvas)
    {
        canvas.strokeStyle = this.Style;
        canvas.lineWidth = this.LineWidth;

        canvas.beginPath();
        canvas.moveTo(this.X, this.Y);
        canvas.lineTo(this.X2, this.Y2);
    }

    Render(canvas)
    {
        this.Build(canvas);
        
        canvas.stroke();
        canvas.fill();
    }
}

class TextureRepeat
{
    constructor(data, x, y, width, height)
    {
        this.Data = data;
        this.X = x;
        this.Y = y;
        this.Width = width;
        this.Height = height;
        this.Image = new Image();

        this.Image.src = this.Data;

        this.ObjType = ObjectType.TextureRepeat;
    }

    GetNearestObject()
    {
        return {
            Object: this,
            Type: PointType.xy
        };
    }

    Build(canvas)
    {

    }

    Render(canvas)
    {
        const pattern = canvas.createPattern(this.Image, "repeat");
        canvas.fillStyle = pattern;
        canvas.fillRect(this.X, this.Y, this.Width, this.Height);
    }
}

class ImageDraw
{
    constructor(data, x, y, width)
    {
        this.Data = data;
        this.X = x;
        this.Y = y;
        this.Width = width;
        this.Height = 0;
        this.Image = new Image();

        this.Image.src = this.Data;

        this.ObjType = ObjectType.Image;
    }

    GetNearestObject()
    {
        return {
            Object: this,
            Type: PointType.xy
        };
    }

    Build(canvas)
    {
        if(this.Height == 0)
        {
            var ratio = this.Image.naturalHeight / this.Image.naturalWidth;

            this.Height = ratio * this.Width;
        }
    }

    Render(canvas)
    {
        //canvas.globalAlpha = 0.2;
        canvas.drawImage(this.Image, this.X, this.Y, this.Width, this.Height);
        //canvas.globalAlpha = 1;
    }
}