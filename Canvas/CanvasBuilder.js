class CanvasBuilder
{
    constructor()
    {
        this.objects = [];
    }

    
    GetBoundingBox()
    {
        var bounds = new BoundingBox(-1,-1,-1,-1);

        for(var v = 0; v < this.objects.length; v++)
        {
            var objB = this.objects[v].GetBoundingBox();

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

    RemoveObject(index)
    {
        if(index < this.objects.length && index > -1)
        {
            if (this.objects[index] != null) 
            {
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
    }

    RemoveSubObject(index, target)
    {
        console.log(index, target);
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