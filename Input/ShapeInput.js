var shapeIndex = 0;
var subIndex = 0;

const PointType = {
    xy:"xy",
    xy2:"xy2",
    c: "c",
    c2: "c2"
};

var currentEditMode = EditModeType.Points;

function UpdateCurve(x, y) {
    if (mousePoints.length > 4) {
        var num1 = parseInt(mousePoints.length / 4);
        var num2 = num1 * 3;

        var two = mousePoints[num1];
        var three = mousePoints[num2];

        var ctrlMid = MathUtilities.getPointAlongLine(0.25, mousePoints[0], mousePoints[mousePoints.length - 1]);
        var ctrlLeft = MathUtilities.getPointAlongLine(2, ctrlMid, two);

        var ctrlFar = MathUtilities.getPointAlongLine(0.75, mousePoints[0], mousePoints[mousePoints.length - 1]);
        var ctrlRight = MathUtilities.getPointAlongLine(2, ctrlFar, three);

        var crv = CurrentShape.GetLatestObject();

        crv.X = x;
        crv.Y = y;
        crv.CX = ctrlLeft.x;
        crv.CY = ctrlLeft.y;
        crv.CX2 = ctrlRight.x;
        crv.CY2 = ctrlRight.y;
    }
}

function AddNewCurve(x, y, cx, cy, cx2, cy2) 
{
    var crv = new CurveTo(x, y, cx, cy, cx2, cy2);

    CurrentShape.AddObject(crv);
}

function StartCurve(mx, my)
{
    mousePoints = [];
    
    CurrentShape = new PathShape(mx, my);

    CurrentShape.Style = foreColor;

    CurrentShape.LineWidth = LineWidth;
    
    AddNewCurve(mx, my, mx, my, mx, my);
}

function ProccessCurve()
{
    var prev = mousePoints[mousePoints.length - 1];
    var cur = new Point(MouseX, MouseY);

    if(mousePoints.length > 0)
    {
        var dist = MathUtilities.getDistance(prev.x, prev.y, cur.x, cur.y);

        for(v = 0; v < dist; v++)
        {
            mousePoints[mousePoints.length] = cur;
        }
    }
    else
    {
        mousePoints[mousePoints.length] = cur;
    }

    if(CurrentShape)
    {
        var last = CurrentShape.GetLatestObject();

        last.X = MouseX;
        last.Y = MouseY;

        if (mousePoints.length > ShapeCutoff) 
        {
            AddNewCurve(MouseX, MouseY, MouseX, MouseY, MouseX, MouseY);

            mousePoints = [];
        }

        UpdateCurve(MouseX, MouseY);
    }
}

function NextShapeIndex()
{
    if(Builder)
    {
        shapeIndex++
        shapeIndex %= Builder.objects.length;
    }
}

function GetNearestObject()
{
    var obj = null;

    if(Builder)
    {
        var last = Builder.objects[shapeIndex];

        if(last != null)
        {
            obj = last.GetNearestObject(MouseX, MouseY, 20, currentEditMode);
        }
    }

    return obj;
}

function UpdateObject(obj, type, x, y)
{
    if(obj)
    {
        if(obj.AnchoredObjects)
        {
            for(var v = 0; v < obj.AnchoredObjects.length; v++)
            {
                var vrt = MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Vertical;
                var hrt = MirrorActive == MirrorType.Both || MirrorActive == MirrorType.Horizontal;

                var pt = GetDif(obj, type, x, y, vrt, hrt);

                AssignObjValues(obj.AnchoredObjects[v], type, pt.DX, pt.DY, true);
            }
        }

        AssignObjValues(obj, type, x, y);
    }
}

function AssignObjValues(obj, type, x, y, anchor = false)
{
    if(type == PointType.xy)
    {
        if(anchor)
        {
            obj.X -= x;
            obj.Y -= y;
        }
        else
        {
            obj.X = x;
            obj.Y = y;
        }
    }

    if(type == PointType.c)
    {
        if(anchor)
        {
            obj.CX -= x;
            obj.CY -= y;
        }
        else
        {
            obj.CX = x;
            obj.CY = y;
        }
    }

    if(type == PointType.c2)
    {
        if(anchor)
        {
            obj.CX2 -= x;
            obj.CY2 -= y;
        }
        else
        {
            obj.CX2 = x;
            obj.CY2 = y;
        }
    }
}

function GetDif(obj, type, x, y, mirrorx = false, mirrory = false)
{
    var dx = 0;
    var dy = 0;

    if(type == PointType.xy)
    {
        dx = obj.X - x;
        dy = obj.Y - y;
    }

    if(type == PointType.c)
    {
        dx = obj.CX - x;
        dy = obj.CY - y;
    }

    if(type == PointType.c2)
    {
        dx = obj.CX2 - x;
        dy = obj.CY2 - y;
    }

    if(mirrorx) dx *= -1;
    if(mirrory) dy *= -1;

    return {
        DX: dx,
        DY: dy
    };
}

function DrawCircles(obj, graphics, radius, editMode = EditModeType.Points)
{
    if(obj != null)
    {
        if(obj.objects)
        {
            for(var v = 0; v < obj.objects.length; v++)
            {
                var sub = obj.objects[v];

                // In Points mode, draw location points (xy)
                // In Curves mode, draw control points (c, c2)
                if(editMode == EditModeType.Points)
                {
                    DrawCircleXY(sub, graphics, radius);
                }
                else if(editMode == EditModeType.Curves)
                {
                    if(sub.ObjType == ObjectType.Curve)
                    {
                        DrawCurveXY(sub, graphics, radius);
                    }
                }
            }
        }
        else
        {
            if(editMode == EditModeType.Points)
            {
                DrawCircleXY(obj, graphics, radius);
            }
        }
    }
}

function DrawCircleXY(obj, graphics, radius)
{
    var circ = new Circle(obj.X, obj.Y, radius);

    circ.Render(graphics);
}

function DrawCurveXY(obj, graphics, radius)
{
    var circ1 = new Circle(obj.CX, obj.CY, radius);

    circ1.Render(graphics);

    var circ2 = new Circle(obj.CX2, obj.CY2, radius);

    circ2.Render(graphics);
}

// Draw bounding box with resize handles
function DrawBoundingBox(obj, graphics, handleSize)
{
    if(obj == null || obj.GetBoundingBox == null) return;
    
    var bbox = obj.GetBoundingBox();
    if(bbox == null) return;
    
    var padding = 8;
    var x = bbox.X - padding;
    var y = bbox.Y - padding;
    var w = bbox.Width + padding * 2;
    var h = bbox.Height + padding * 2;
    
    // Draw bounding box outline
    graphics.beginPath();
    graphics.rect(x, y, w, h);
    graphics.strokeStyle = '#64ffda';
    graphics.lineWidth = 1;
    graphics.setLineDash([5, 3]);
    graphics.stroke();
    graphics.setLineDash([]);
    
    // Draw handles
    var handles = GetHandlePositions(x, y, w, h, handleSize);
    
    graphics.fillStyle = '#64ffda';
    graphics.strokeStyle = '#1a1d2e';
    graphics.lineWidth = 1;
    
    for(var key in handles)
    {
        var handle = handles[key];
        graphics.beginPath();
        graphics.rect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
        graphics.fill();
        graphics.stroke();
    }
    
    return { x: x, y: y, width: w, height: h, handles: handles };
}

function GetHandlePositions(x, y, w, h, handleSize)
{
    return {
        'nw': { x: x, y: y },
        'n': { x: x + w/2, y: y },
        'ne': { x: x + w, y: y },
        'e': { x: x + w, y: y + h/2 },
        'se': { x: x + w, y: y + h },
        's': { x: x + w/2, y: y + h },
        'sw': { x: x, y: y + h },
        'w': { x: x, y: y + h/2 }
    };
}

function GetHandleAtPoint(obj, px, py, handleSize)
{
    if(obj == null || obj.GetBoundingBox == null) return null;
    
    var bbox = obj.GetBoundingBox();
    if(bbox == null) return null;
    
    var padding = 8;
    var x = bbox.X - padding;
    var y = bbox.Y - padding;
    var w = bbox.Width + padding * 2;
    var h = bbox.Height + padding * 2;
    
    var handles = GetHandlePositions(x, y, w, h, handleSize);
    
    for(var key in handles)
    {
        var handle = handles[key];
        if(Math.abs(px - handle.x) <= handleSize && Math.abs(py - handle.y) <= handleSize)
        {
            return key;
        }
    }
    
    // Check if inside bounding box (for move)
    if(px >= x && px <= x + w && py >= y && py <= y + h)
    {
        return 'move';
    }
    
    return null;
}

function MoveShape(obj, dx, dy)
{
    if(obj == null || obj.objects == null) return;
    
    for(var v = 0; v < obj.objects.length; v++)
    {
        var sub = obj.objects[v];
        
        if(sub.ObjType == ObjectType.Move)
        {
            sub.X += dx;
            sub.Y += dy;
        }
        else if(sub.ObjType == ObjectType.Curve)
        {
            sub.X += dx;
            sub.Y += dy;
            sub.CX += dx;
            sub.CY += dy;
            sub.CX2 += dx;
            sub.CY2 += dy;
        }
    }
}

function ResizeShape(obj, handle, startBounds, currentX, currentY, originalPoints)
{
    if(obj == null || obj.objects == null || startBounds == null || originalPoints == null) return;
    
    var padding = 8;
    // The handles are drawn with padding, so we need to account for that
    // Handle positions are at: bbox.X - padding, bbox.Y - padding, etc.
    var startMinX = startBounds.X;
    var startMinY = startBounds.Y;
    var startMaxX = startBounds.X + startBounds.Width;
    var startMaxY = startBounds.Y + startBounds.Height;
    var startW = startBounds.Width;
    var startH = startBounds.Height;
    
    // Calculate new bounds based on handle
    // The mouse is at the handle position (which includes padding)
    // We need to subtract padding to get the actual shape bounds
    var newMinX = startMinX;
    var newMinY = startMinY;
    var newMaxX = startMaxX;
    var newMaxY = startMaxY;
    
    switch(handle)
    {
        case 'nw':
            newMinX = currentX + padding;
            newMinY = currentY + padding;
            break;
        case 'n':
            newMinY = currentY + padding;
            break;
        case 'ne':
            newMaxX = currentX - padding;
            newMinY = currentY + padding;
            break;
        case 'e':
            newMaxX = currentX - padding;
            break;
        case 'se':
            newMaxX = currentX - padding;
            newMaxY = currentY - padding;
            break;
        case 's':
            newMaxY = currentY - padding;
            break;
        case 'sw':
            newMinX = currentX + padding;
            newMaxY = currentY - padding;
            break;
        case 'w':
            newMinX = currentX + padding;
            break;
    }
    
    // Ensure proper ordering (handle negative sizes)
    var finalMinX = Math.min(newMinX, newMaxX);
    var finalMaxX = Math.max(newMinX, newMaxX);
    var finalMinY = Math.min(newMinY, newMaxY);
    var finalMaxY = Math.max(newMinY, newMaxY);
    
    // Enforce minimum size of 10 pixels
    if(finalMaxX - finalMinX < 10) finalMaxX = finalMinX + 10;
    if(finalMaxY - finalMinY < 10) finalMaxY = finalMinY + 10;
    
    var newW = finalMaxX - finalMinX;
    var newH = finalMaxY - finalMinY;
    
    // Apply transformation to all objects based on original positions
    for(var v = 0; v < obj.objects.length; v++)
    {
        var sub = obj.objects[v];
        var orig = originalPoints[v];
        
        if(sub.ObjType == ObjectType.Move)
        {
            // Map from old coordinate space to new
            var relX = (orig.X - startMinX) / startW;
            var relY = (orig.Y - startMinY) / startH;
            sub.X = finalMinX + relX * newW;
            sub.Y = finalMinY + relY * newH;
        }
        else if(sub.ObjType == ObjectType.Curve)
        {
            var relX = (orig.X - startMinX) / startW;
            var relY = (orig.Y - startMinY) / startH;
            var relCX = (orig.CX - startMinX) / startW;
            var relCY = (orig.CY - startMinY) / startH;
            var relCX2 = (orig.CX2 - startMinX) / startW;
            var relCY2 = (orig.CY2 - startMinY) / startH;
            
            sub.X = finalMinX + relX * newW;
            sub.Y = finalMinY + relY * newH;
            sub.CX = finalMinX + relCX * newW;
            sub.CY = finalMinY + relCY * newH;
            sub.CX2 = finalMinX + relCX2 * newW;
            sub.CY2 = finalMinY + relCY2 * newH;
        }
    }
}

// Helper function to save original point positions for resize
function SaveOriginalPoints(obj)
{
    if(obj == null || obj.objects == null) return null;
    
    var points = [];
    for(var v = 0; v < obj.objects.length; v++)
    {
        var sub = obj.objects[v];
        if(sub.ObjType == ObjectType.Move)
        {
            points.push({ X: sub.X, Y: sub.Y });
        }
        else if(sub.ObjType == ObjectType.Curve)
        {
            points.push({
                X: sub.X, Y: sub.Y,
                CX: sub.CX, CY: sub.CY,
                CX2: sub.CX2, CY2: sub.CY2
            });
        }
        else
        {
            points.push({});
        }
    }
    return points;
}