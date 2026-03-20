function SaveSVG(builder, width = 3000, height = 3000)
{
    var filetxt = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" height="${height}" width="${width}">`;

    for(var v = 0; v < builder.objects.length; v++)
    {
        var obj = builder.objects[v];

        if(obj.ObjType == ObjectType.Path)
        {
            var pathData = obj.GetSvgData();
            var svgStyle = `fill:${obj.Fill};stroke:${obj.Style};stroke-width:${obj.LineWidth}`;
            filetxt += `<path d="${pathData}" style="${svgStyle}" />`;
        }
        else if(obj.ObjType == ObjectType.Image)
        {
            filetxt += `<image x="${obj.X}" y="${obj.Y}" width="${obj.Width}" height="${obj.Height}" xlink:href="${obj.Data}" />`;
        }
    }

    filetxt += "</svg>";

    return filetxt;
}

function SaveToRawText(data)
{
    var filename = "design.svg";
    var file = new Blob([data], {type: 'text/plain'});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}

function handleFileSVG(files){
    // SVG import is not yet implemented; only raster image drop is supported.
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        
        // Make sure the file is an image

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                var img = new ImageDraw(e.target.result, MouseX,MouseY,512,512);
                Builder.AddObject(img);
            }
            
            reader.readAsDataURL(file);
        } else {
            alert('Please drop an image file');
        }
    }
}