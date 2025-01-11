var backColor = "#449944";
var foreColor = "#99FF99";
var aidColor = "#7777AA";

var canvasWidth = 0;
var canvasHeight = 0;

var backtexture = new TextureRepeat("img/clothDark.jpg", 0, 0, canvasWidth, canvasHeight);

function BuildCanvas(canvasObject)
{
    canvasWidth = canvasObject.width;
    canvasHeight = canvasObject.height;
        
    canvasWidth = window.innerWidth
    || document.documentElement.clientWidth
    || document.body.clientWidth;

    canvasHeight = window.innerHeight
    || document.documentElement.clientHeight
    || document.body.clientHeight;

    canvasObject.width = canvasWidth;
    canvasObject.height = canvasHeight * 1.2; // '* 1.2' prevents fullscreen from missing bottom

    backtexture = new TextureRepeat("img/clothDark.jpg", 0, 0, canvasWidth, canvasHeight);
}

function ClearCanvas(CanvasObject, canvasContext)
{
    canvasContext.fillStyle = backColor;
    canvasContext.fillRect(0, 0, CanvasObject.width, CanvasObject.height)

    canvasContext.fill();
}

// need to refactor this function cause its bad
function DrawUserHotkeys(graphics)
{
    var selectColor =  "#11FF99";
    var noselectclr =  foreColor;

    graphics.fillStyle = noselectclr;
    graphics.font = "bold 16px Arial";
    graphics.textAlign = 'left';
    graphics.textBaseline = 'middle';

    if(currentState == DrawingState.DrawCurve) graphics.fillStyle = selectColor;
    else  graphics.fillStyle = noselectclr;

    graphics.fillText("Draw Curve:", 100, 80);
    graphics.fillText(HotKeys.DrawCurve, 250, 80);

    if(currentState == DrawingState.AddCurve) graphics.fillStyle = selectColor;
    else  graphics.fillStyle = noselectclr;

    graphics.fillText("Add Curve:", 100, 100);
    graphics.fillText(HotKeys.AddCurve, 250, 100);

    if(currentState == DrawingState.Edit) graphics.fillStyle = selectColor;
    else  graphics.fillStyle = noselectclr;

    graphics.fillText("Edit Mode:", 100, 120);
    graphics.fillText(HotKeys.EditMode, 250, 120);

    graphics.fillStyle = noselectclr; //reset

    graphics.fillText("Save Shapes:", 100, 140);
    graphics.fillText(HotKeys.SaveShapes, 250, 140);

    if(MirrorActive != MirrorType.None) graphics.fillStyle = selectColor;
    else  graphics.fillStyle = noselectclr;

    graphics.fillText("Toggle Mirror:", 100, 160);
    graphics.fillText(HotKeys.Mirror, 250, 160);

    if(grid.Enabled) graphics.fillStyle = selectColor;
    else  graphics.fillStyle = noselectclr;

    graphics.fillText("Toggle Grid:", 100, 180);
    graphics.fillText(HotKeys.Grid, 250, 180);

    graphics.fillStyle = noselectclr; //reset

    graphics.fillText("Next Shape:", 100, 200);
    graphics.fillText(HotKeys.SelectNextShape, 250, 200);

    graphics.fillText("Delete Shape:", 100, 220);
    graphics.fillText(HotKeys.Delete, 250, 220);

    graphics.fillText("Color Menu:", 100, 240);
    graphics.fillText(HotKeys.Color, 250, 240);

    graphics.fillText("Hide Cursor:", 100, 260);
    graphics.fillText(HotKeys.HideCursor, 250, 260);

    graphics.fillText("Move Shape:", 100, 280);
    graphics.fillText(HotKeys.MoveShape, 250, 280);

    graphics.fillText("Duplicate Shape:", 100, 300);
    graphics.fillText(HotKeys.CopyShape, 250, 300);

}