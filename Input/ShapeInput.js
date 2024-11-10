function UpdateCurve(x, y) {
    if (mousePoints.length > 0) {
        var num1 = parseInt(mousePoints.length / 4);
        var num2 = num1 * 3;

        var two = mousePoints[num1];
        var three = mousePoints[num2];

        var ctrlMid = MathUtilities.getPointAlongLine(0.25, mousePoints[0], mousePoints[mousePoints.length - 1]);
        var ctrlLeft = MathUtilities.getPointAlongLine(2, ctrlMid, two);

        var ctrlFar = MathUtilities.getPointAlongLine(0.75, mousePoints[0], mousePoints[mousePoints.length - 1]);
        var ctrlRight = MathUtilities.getPointAlongLine(2, ctrlFar, three);

        var crv = currentCurve.GetLatestObject();

        crv.X = x;
        crv.Y = y;
        crv.CX = ctrlLeft.x;
        crv.CY = ctrlLeft.y;
        crv.CX2 = ctrlRight.x;
        crv.CY2 = ctrlRight.y;
    }
}