function BuildCanvas(canvasObject)
{
    var w = canvasObject.width;
    var h = canvasObject.height;
        
    w = window.innerWidth
    || document.documentElement.clientWidth
    || document.body.clientWidth;

    h = window.innerHeight
    || document.documentElement.clientHeight
    || document.body.clientHeight;

    canvasObject.width = w;
    canvasObject.height = h * 1.2;
}