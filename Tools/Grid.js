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
}