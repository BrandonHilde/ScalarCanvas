function  SaveSVG(builder, width = 1000, height = 1000, cssStyle = "fill:none;stroke:green;stroke-width:3") 
{  
    let pathData = "";

    for(var v = 0; v < builder.objects.length; v++)
    {
        var obj = builder.objects[v];
        if(obj.ObjType == ObjectType.Path)
        {
            pathData += obj.GetSvgData();
        }
    }

    const filetxt = `<svg xmlns="http://www.w3.org/2000/svg" height="${height}" width="${width}">
    <path d="${pathData}" style="${cssStyle}" /></svg>`;

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