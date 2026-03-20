class CanvasBuilder
{
    constructor()
    {
        this.objects = [];
    }

    
    GetBoundingBox()
    {
        var minX = null, minY = null, maxX = null, maxY = null;

        for(var v = 0; v < this.objects.length; v++)
        {
            var obj = this.objects[v];
            if(!obj || !obj.GetBoundingBox) continue;

            var objB = obj.GetBoundingBox();

            var objMaxX = objB.X + objB.Width;
            var objMaxY = objB.Y + objB.Height;

            if(minX === null || objB.X < minX) minX = objB.X;
            if(minY === null || objB.Y < minY) minY = objB.Y;
            if(maxX === null || objMaxX > maxX) maxX = objMaxX;
            if(maxY === null || objMaxY > maxY) maxY = objMaxY;
        }

        if(minX === null) return new BoundingBox(0, 0, 0, 0);

        return new BoundingBox(minX, minY, maxX - minX, maxY - minY);
    }

    RemoveObject(index)
    {
        var removed = null;
        if(index < this.objects.length && index > -1)
        {
            if (this.objects[index] != null)
            {
                removed = this.objects[index];
                if(index == 0 && this.objects.length == 1)
                {
                    this.objects = [];
                }
                else
                {
                    this.objects.splice(index, 1);
                }
            }
        }
        return removed;
    }

    RemoveSubObject(index, target)
    {
        if(index < this.objects.length && index > -1)
        {
            if (this.objects[index] != null) 
            {
                if(index == 0 && this.objects[index].objects.length == 1)
                {
                    this.objects[target].objects = []
                }
                else
                {
                    this.objects[index].objects.splice(target, 1);
                }
            }
        }        
    }

    AddObject(obj)
    {
        this.objects[this.objects.length] = obj;
    }

    GetLatestObject()
    {
        return this.objects[this.objects.length - 1];
    }

    Build(canvas)
    {
        for(var v = 0; v < this.objects.length; v++)
        {
            if(this.objects[v] != null)
            {
                this.objects[v].Build(canvas);
            }
        }
    }

    RenderAll(canvas)
    {
        // MARK: CHANGE HHOW RENDERALL WORKS
        for(var v = 0; v < this.objects.length; v++)
        {
            if(this.objects[v] != null)
            {
                this.objects[v].Render(canvas);
            }
        }
        canvas.beginPath();
    }

    Render(canvas)
    {
        this.Build(canvas);
        
        canvas.stroke();
        canvas.fill();
        canvas.beginPath();
    }
}

class BoundingBox{
    constructor(x,y, w, h)
    {
        this.X = x;
        this.Y = y;
        this.Width = w;
        this.Height = h;
    }

    GetResizeBox(w, h)
    {
        var bx = new BoundingBox(this.X, this.Y, this.Width, this.Height);

        var ratio = this.Width / this.Height;

        var wx = w * ratio;
        var hx = h;

        bx.X -= wx;
        bx.Y -= hx;
        bx.Width += wx * 2;
        bx.Height += hx * 2;

        return bx;
    }

    PointMap(x, y, OtherBox)
    {
        var nx = 0;
        var ny = 0;

        var difx = x - this.X;
        var dify = y - this.Y;

        var rx = difx / this.Width;
        var ry = dify / this.Height;

        nx = OtherBox.X + (rx * OtherBox.Width);
        ny = OtherBox.Y + (ry * OtherBox.Height);

        return {
            X: nx,
            Y: ny
        }
    }

    Render(canvas)
    {        
        canvas.fillRect(this.X, this.Y, this.Width, this.Height);
        canvas.stroke();
        canvas.fill();
        canvas.beginPath();
    }
}