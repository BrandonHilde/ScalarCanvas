var MirrorObjs = [];

var startID = 10000;

const MirrorType = {
    Vertical: 0,
    Horizontal: 1,
    Both: 2,
    None: 3
};

class MirrorObj{
    constructor(type, x, y)
    {
        this.mType = type;
        this.ID = startID++;
        this.Shape = null;
        this.MirrorX = x;
        this.MirrorY = y;
    }

    ReplicateAsMirror(Obj)
    {
        var shape = new PathShape(0,0);

        for(var v = 0; v < Obj.objects.length; v++)
        {
            shape.objects[v] = this.Mirror(Obj.objects[v]);
        }

        shape.Style = Obj.Style;
        shape.Fill = Obj.Fill;

        return shape;
    }

    Mirror(Obj)
    {
        if(Obj)
        {
            if(this.mType == MirrorType.Vertical)
            {
                if(Obj.ObjType == ObjectType.Move)
                {
                   var val = MathUtilities.getMirrorValue(this.MirrorX, Obj.X);

                   return new MoveTo(val, Obj.Y);
                }
                else
                {
                    var val = MathUtilities.getMirrorValue(this.MirrorX, Obj.X);
                    var valCx = MathUtilities.getMirrorValue(this.MirrorX, Obj.CX);
                    var valC2 = MathUtilities.getMirrorValue(this.MirrorX, Obj.CX2);

                    return new CurveTo(val, Obj.Y, valCx, Obj.CY, valC2, Obj.CY2);
                }
            }
            else if (this.mType == MirrorType.Horizontal)
            {
                if(Obj.ObjType == ObjectType.Move)
                {
                    var val = MathUtilities.getMirrorValue(this.MirrorY, Obj.Y);

                    return new MoveTo(Obj.X, val);
                }
                else
                {
                    var val = MathUtilities.getMirrorValue(this.MirrorY, Obj.Y);
                    var valCy = MathUtilities.getMirrorValue(this.MirrorY, Obj.CY);
                    var valC2 = MathUtilities.getMirrorValue(this.MirrorY, Obj.CY2);

                    return new CurveTo(Obj.X, val, Obj.CX, valCy, Obj.CX2, valC2);
                }
            }
            else if(this.mType == MirrorType.Both)
            {
                if(Obj.ObjType == ObjectType.Move)
                {
                    var valx = MathUtilities.getMirrorValue(this.MirrorX, Obj.X);
                    var valy = MathUtilities.getMirrorValue(this.MirrorY, Obj.Y);

                    return new MoveTo(valx, valy);
                }
                else
                {
                    var valx = MathUtilities.getMirrorValue(this.MirrorX, Obj.X);
                    var valCx = MathUtilities.getMirrorValue(this.MirrorX, Obj.CX);
                    var valCx2 = MathUtilities.getMirrorValue(this.MirrorX, Obj.CX2);

                    var valy = MathUtilities.getMirrorValue(this.MirrorY, Obj.Y);
                    var valCy = MathUtilities.getMirrorValue(this.MirrorY, Obj.CY);
                    var valCy2 = MathUtilities.getMirrorValue(this.MirrorY, Obj.CY2);

                    return new CurveTo(valx, valy, valCx, valCy, valCx2, valCy2);
                }
            }
        }
    }    
}