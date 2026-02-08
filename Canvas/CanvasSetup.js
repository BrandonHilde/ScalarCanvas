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

// Replaced by HTML toolbar
function DrawUserHotkeys(graphics)
{
}

function UpdateToolbar()
{
    var buttons = document.querySelectorAll('#toolbar button[data-mode]');
    for(var i = 0; i < buttons.length; i++)
    {
        buttons[i].classList.remove('active');
        if(buttons[i].getAttribute('data-mode') === currentState)
        {
            buttons[i].classList.add('active');
        }
    }

    var mirrorBtn = document.getElementById('btn-mirror');
    if(mirrorBtn)
    {
        mirrorBtn.classList.remove('toggle-on');
        if(MirrorActive == MirrorType.None) mirrorBtn.textContent = 'Mirror: Off';
        else if(MirrorActive == MirrorType.Vertical) { mirrorBtn.textContent = 'Mirror: V'; mirrorBtn.classList.add('toggle-on'); }
        else if(MirrorActive == MirrorType.Horizontal) { mirrorBtn.textContent = 'Mirror: H'; mirrorBtn.classList.add('toggle-on'); }
        else if(MirrorActive == MirrorType.Both) { mirrorBtn.textContent = 'Mirror: Both'; mirrorBtn.classList.add('toggle-on'); }
    }

    var gridBtn = document.getElementById('btn-grid');
    if(gridBtn)
    {
        gridBtn.classList.remove('toggle-on');
        if(grid.Enabled) gridBtn.classList.add('toggle-on');
    }
}

function UpdateStatusBar()
{
    var bar = document.getElementById('statusbar');
    if(!bar) return;

    var modeStr = currentState;
    var shapeStr = Builder.objects.length > 0
        ? (shapeIndex + 1) + '/' + Builder.objects.length
        : 'none';

    var mirrorStr = 'Off';
    if(MirrorActive == MirrorType.Vertical) mirrorStr = 'Vertical';
    else if(MirrorActive == MirrorType.Horizontal) mirrorStr = 'Horizontal';
    else if(MirrorActive == MirrorType.Both) mirrorStr = 'Both';

    var gridStr = grid.Enabled ? 'On' : 'Off';

    bar.innerHTML =
        '<span class="status-label">Mode:</span> <span class="status-mode">' + modeStr + '</span>' +
        '<span class="status-label">Shape:</span> <span>' + shapeStr + '</span>' +
        '<span class="status-label">Mirror:</span> <span>' + mirrorStr + '</span>' +
        '<span class="status-label">Grid:</span> <span>' + gridStr + '</span>';
}