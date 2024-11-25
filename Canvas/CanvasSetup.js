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

function DrawUserHotkeys(graphics)
{
    graphics.fillStyle = "#99FF99";
    graphics.font = "bold 16px Arial";
    graphics.textAlign = 'left';
    graphics.textBaseline = 'middle';

    graphics.fillText("Add Curve:", 100, 100);
    graphics.fillText(HotKeys.AddCurve, 250, 100);

    graphics.fillText("Edit Mode:", 100, 120);
    graphics.fillText(HotKeys.EditMode, 250, 120);

    graphics.fillText("Save Shapes:", 100, 140);
    graphics.fillText(HotKeys.SaveShapes, 250, 140);

    graphics.fillText("Toggle Mirror:", 100, 160);
    graphics.fillText(HotKeys.Mirror, 250, 160);

    graphics.fillText("Toggle Grid:", 100, 180);
    graphics.fillText(HotKeys.Grid, 250, 180);

    graphics.fillText("Next Shape:", 100, 200);
    graphics.fillText(HotKeys.SelectNextShape, 250, 200);

}