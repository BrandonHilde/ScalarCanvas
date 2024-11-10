class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static get Empty() {
        return new Point(0, 0);
    }
}

class MathUtilities {
    static getDistance(x1, y1, x2, y2) 
    {
        return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    }

    static getMidPoint(x1, y1, x2, y2) {
        return new Point((x1 + x2) / 2, (y1 + y2) / 2);
    }

    static getWidePoint(x1, y1, x2, y2, mx, my, distance) {
        if (arguments.length === 3) {
            // If called with Slope Point, mx, my, distance
            const slope = x1;
            mx = y1;
            my = x2;
            distance = y2;
            const x = mx + (distance * (-slope.y));
            const y = my + (distance * (slope.x));
            return new Point(x, y);
        }

        const slope = this.getSlopeXY(x1, y1, x2, y2);
        const x = mx + (distance * (-slope.y));
        const y = my + (distance * (slope.x));
        return new Point(x, y);
    }

    static getSlopeXY(x1, y1, x2, y2) {
        const dist = this.getDistance(x1, y1, x2, y2);

        let slopeX = 1;
        let slopeY = 1;

        if (dist !== 0) {
            slopeX = (x2 - x1) / dist;
            slopeY = (y2 - y1) / dist;
        }

        return new Point(slopeX, slopeY);
    }

    static getSlidePoint(moveStrength, anchor, location, target) {
        if (arguments.length === 3) {
            // If called with moveStrength, Slope, Location
            const slope = anchor;
            location = location;
            const x = location.x + (moveStrength * (slope.x));
            const y = location.y + (moveStrength * (slope.y));
            return new Point(x, y);
        }

        const slope = this.getSlopeXY(anchor.x, anchor.y, target.x, target.y);
        const x = location.x + (moveStrength * (slope.x));
        const y = location.y + (moveStrength * (slope.y));
        return new Point(x, y);
    }

    static getPointAlongLine(percent, start, end) {
        const dist = this.getDistance(start.x, start.y, end.x, end.y);
        const slope = this.getSlopeXY(start.x, start.y, end.x, end.y);

        const dx = slope.x;
        const dy = slope.y;
        const perdist = percent * dist;

        const value = new Point(
            start.x + (perdist * dx),
            start.y + (perdist * dy)
        );

        if (isNaN(value.x) || isNaN(value.y)) {
            return Point.Empty;
        }

        return value;
    }

    static getSlope(x1, y1, x2, y2) {
        return (y2 - y1) / (x2 - x1);
    }

    static linesIntersect(one, two, first, last) {
        const A1 = one.y - two.y;
        const B1 = one.x - two.x;
        const C1 = A1 * two.x + B1 * two.y;

        const A2 = first.y - last.y;
        const B2 = first.x - last.x;
        const C2 = A2 * last.x + B2 * last.y;

        const delta = A1 * B2 - A2 * B1;

        if (delta !== 0) {
            const x = (B2 * C1 - B1 * C2) / delta;
            const y = (A1 * C2 - A2 * C1) / delta;
            return new Point(x, y);
        }

        return new Point(-1, -1);
    }
}