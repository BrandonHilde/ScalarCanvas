class Grid
{
    constructor(w, h, size = 20)
    {
        this.Width = w;
        this.Height = h;
        this.Size = size;
        this.OffsetX = this.Size - ((this.Width/2) % this.Size);
        this.OffsetY = this.Size - ((this.Height/2) % this.Size);
        this.Enabled = false;
    }

    CalcOffset()
    {
        this.OffsetX = this.Size - ((this.Width/2) % this.Size);
        this.OffsetY = this.Size - ((this.Height/2) % this.Size);
    }

    GetValue(value, offset)
    {
        var rm = (value % this.Size) + offset;

        var lrg = value - rm + this.Size;
        var sml = value - rm;

        var difs = sml - value;
        if(difs < 0) difs *= -1;

        var difl = lrg - value;
        if(difl < 0) difl *= -1;

        if(difl > difs)
        {
            return sml; // + offset;
        }
        else
        {
            return lrg; //+ offset;
        }
    }

    GetMouseLock(x, y)
    {
        if(this.Enabled)
        {
           var valX = this.GetValue(x, this.OffsetX);
           var valY = this.GetValue(y, this.OffsetY);

           return new Point(valX, valY);
        }
        else
        {
            return new Point(x,y);
        }
    }

    DrawGrid(graphics)
    {
        var sx = 3;

        for(var x = (this.Size - this.OffsetX); x < 2000; x+= this.Size)
        {
            for(var y = (this.Size - this.OffsetY); y < 1200; y+= this.Size)
            {
                var lnh = new Line(x, y - sx, x, y + sx,aidColor);
                lnh.LineWidth = 1;
                lnh.Render(graphics);

                var lnh = new Line(x - sx, y, x + sx, y,aidColor);
                lnh.LineWidth = 1;
                lnh.Render(graphics);
            }
        }
    }
}