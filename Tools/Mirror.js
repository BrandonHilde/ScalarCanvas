var MirrorObjs = [];

var startID = 10000;

class MirrorObj{
    constructor(isVerticle, x, y)
    {
        this.Verticle = isVerticle;
        this.ID = startID++;
        this.Shape = null;
        this.MirrorX = x;
        this.MirrorY = y;
    }

    ReplicateAsMirror(Obj)
    {
        console.log(Obj);
        var shape = new PathShape(0,0);

        for(var v = 0; v < Obj.objects.length; v++)
        {
            shape.objects[v] = this.Mirror(Obj.objects[v]);
        }

        console.log(shape);

        return shape;
    }

    Mirror(Obj)
    {
        if(Obj)
        {
            if(this.Verticle)
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
        }
    }    
}