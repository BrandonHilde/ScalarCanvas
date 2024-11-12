class CanvasBuilder
{
    constructor()
    {
        this.objects = [];
    }

    AddObject(obj)
    {
        this.objects[this.objects.length] = obj;
    }

    GetLatestObject()
    {
        return this.objects[this.objects.length - 1];
    }

    Build()
    {

    }

    Render(canvas)
    {

		for(var v = 0; v < this.objects.length; v++)
        {
            this.objects[v].Render(canvas);
        }

        canvas.stroke();
        canvas.fill();
        canvas.beginPath();
    }
}