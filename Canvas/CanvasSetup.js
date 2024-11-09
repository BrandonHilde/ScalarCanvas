var backColor = "#449944";

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
    canvasObject.height = h * 1.2; // '* 1.2' prevents fullscreen from missing bottom
}

function ClearCanvas(CanvasObject, canvasContext)
{
    canvasContext.fillStyle = backColor;
    canvasContext.fillRect(0, 0, CanvasObject.width, CanvasObject.height)

    canvasContext.fill();
}