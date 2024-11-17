var MirrorObjs = [];

var startID = 10000;

class MirrorObj{
    constructor(mirrorAngle, x, y)
    {
        this.Angle = mirrorAngle;
        this.ID = startID++;
        this.Shape = null;
        this.MirrorX = x;
        this.MirrorY = y;
    }

    ReplicateAsMirror(Obj)
    {
        this.Shape = Mirror(Obj);
    }

    Mirror(Obj)
    {

    }
    
    // StartCurve(mx, my)
    // {
    //     mousePoints = [];
    //     CurrentShape = new PathShape(mx, my);
    //     AddNewCurve(mx, my, mx, my, mx, my);
    // }
    
}