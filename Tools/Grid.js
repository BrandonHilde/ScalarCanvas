class Grid
{
    constructor(size = 20)
    {
        this.Size = size;
        this.Enabled = false;
    }

    GetMouseLock(value)
    {
        if(this.Enabled)
        {
            var rm = value % this.Size;

            var lrg = value - rm + this.Size;
            var sml = value - rm;

            var difs = sml - value;
            if(difs < 0) difs *= -1;

            var difl = lrg - value;
            if(difl < 0) difl *= -1;

            if(difl > difs)
            {
                return sml;
            }
            else
            {
                return lrg;
            }
        }
        else
        {
            return value;
        }
    }

    DrawGrid(graphics)
    {
        for(var x = this.Size; x < 2000; x+= this.Size)
        {
            for(var y = this.Size; y < 1200; y+= this.Size)
            {
                var lnh = new Line(x, 0, x, 1200,"#000000");
                lnh.LineWidth = 1;
                lnh.Render(graphics);

                var lnh = new Line(0, y, 2000, y,"#000000");
                lnh.LineWidth = 1;
                lnh.Render(graphics);
            }
        }
    }
}