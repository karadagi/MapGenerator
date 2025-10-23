import * as log from 'loglevel';
import DomainController from './domain_controller';
import TensorField from '../impl/tensor_field';
import Graph from '../impl/graph';
import Vector from '../vector';
import PolygonFinder from '../impl/polygon_finder';
import {PolygonParams} from '../impl/polygon_finder';
import PolygonUtil from '../impl/polygon_util';

export interface BuildingModel {
    height: number;
    lotWorld: Vector[]; // In world space
    lotScreen: Vector[]; // In screen space
    roof: Vector[]; // In screen space
    sides: Vector[][]; // In screen space
}

/**
 * Pseudo 3D buildings
 */
class BuildingModels {
    private domainController = DomainController.getInstance();
    private _buildingModels: BuildingModel[] = [];

    constructor(lots: Vector[][], minHeight: number, heightRange: number) {  // Lots in world space
        for (const lot of lots) {
            this._buildingModels.push({
                height: (Math.random() * heightRange) + minHeight,
                lotWorld: lot,
                lotScreen: [],
                roof: [],
                sides: []
            });
        }
        this._buildingModels.sort((a, b) => a.height - b.height);
    }

    get buildingModels(): BuildingModel[] {
        return this._buildingModels;
    }

    setBuildingProjections(): void {
        const d = 1000 / this.domainController.ZOOM;
        const cameraPos = this.domainController.getCameraPosition();
        for (const b of this._buildingModels) {
            b.lotScreen = b.lotWorld.map(v => this.domainController.worldToScreen(v.clone()));
            b.roof = b.lotScreen.map(v => this.heightVectorToScreen(v, b.height, d, cameraPos));
            b.sides = this.getBuildingSides(b);
        }
    }

    // --- REVERTED as requested. This is your original formula. ---
    private heightVectorToScreen(v: Vector, h: number, d: number, camera: Vector): Vector {
        const scale = (d / (d - h)); // 0.1
        if (this.domainController.orthographic) {
            const diff = this.domainController.cameraDirection.multiplyScalar(-h * scale);
            return v.clone().add(diff);
        } else {
            return v.clone().sub(camera).multiplyScalar(scale).add(camera);
        }
    }

    private getBuildingSides(b: BuildingModel): Vector[][] {
        const polygons: Vector[][] = [];
        for (let i = 0; i < b.lotScreen.length; i++) {
            const next = (i + 1) % b.lotScreen.length;
            polygons.push([b.lotScreen[i], b.lotScreen[next], b.roof[next], b.roof[i]]);
        }
        return polygons;
    }
}

/**
 * Finds building lots and optionally pseudo3D buildings
 */
export default class Buildings {
    private polygonFinder: PolygonFinder;
    private allStreamlines: Vector[][] = [];
    private domainController = DomainController.getInstance();
    private preGenerateCallback: () => any = () => {};
    private postGenerateCallback: () => any = () => {};

    private _models: BuildingModels = new BuildingModels([], 20, 20);

    private heightParams = {
        minHeight: 20,
        heightRange: 20
    };

    private buildingMode: 'divide' | 'courtyard' = 'divide';

    private courtyardParams = {
        courtyardDepth: 20, // World-space units to clear
    };

    private buildingParams: PolygonParams = {
        maxLength: 20,
        minArea: 50,
        shrinkSpacing: 4,
        chanceNoDivide: 0.05,
    };

    constructor(private tensorField: TensorField,
                folder: dat.GUI,
                private redraw: () => void,
                private dstep: number,
                private _animate: boolean) {
        folder.add({'Add Buildings': () => this.generate(this._animate)}, 'Add Buildings');
        folder.add(this, 'buildingMode', ['divide', 'courtyard']).name('Building Mode');
        folder.add(this.courtyardParams, 'courtyardDepth', 5, 50).step(1).name('Courtyard Depth');
        folder.add(this.heightParams, 'minHeight', 0, 100).step(1).name('Min Height');
        folder.add(this.heightParams, 'heightRange', 0, 100).step(1).name('Height Range');
        folder.add(this.buildingParams, 'maxLength');
        folder.add(this.buildingParams, 'minArea');
        folder.add(this.buildingParams, 'shrinkSpacing');
        folder.add(this.buildingParams, 'chanceNoDivide');
        this.polygonFinder = new PolygonFinder([], this.buildingParams, this.tensorField);
    }

    set animate(v: boolean) {
        this._animate = v;
    }

    get lots(): Vector[][] {
        return this.polygonFinder.polygons.map(p => p.map(v => this.domainController.worldToScreen(v.clone())));
    }

    getBlocks(): Promise<Vector[][]> {
        const g = new Graph(this.allStreamlines, this.dstep, true);
        const blockParams = Object.assign({}, this.buildingParams);
        blockParams.shrinkSpacing = blockParams.shrinkSpacing/2;
        const polygonFinder = new PolygonFinder(g.nodes, blockParams, this.tensorField);
        polygonFinder.findPolygons();
        return polygonFinder.shrink(false).then(() => polygonFinder.polygons.map(p => p.map(v => this.domainController.worldToScreen(v.clone()))));
    }

    get models(): BuildingModel[] {
        this._models.setBuildingProjections();
        return this._models.buildingModels;
    }

    setAllStreamlines(s: Vector[][]): void {
        this.allStreamlines = s;
    }

    reset(): void {
        this.polygonFinder.reset();
        this._models = new BuildingModels([], this.heightParams.minHeight, this.heightParams.minHeight);
    }

    update(): boolean {
        return this.polygonFinder.update();
    }

    // --- REMOVED my buggy insetPolygon function ---

    // --- Helper function to get polygon center ---
    private getPolygonCenter(poly: Vector[]): Vector {
        const center = new Vector(0, 0);
        if (!poly || poly.length === 0) return center;
        for (const p of poly) {
            center.add(p);
        }
        center.divideScalar(poly.length);
        return center;
    }

    // --- Helper function to check if a point is in a polygon ---
    private pointInPolygon(point: Vector, vs: Vector[]): boolean {
        // ray-casting algorithm
        const x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;

            const intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Finds blocks, shrinks and divides them to create building lots
     */
    async generate(animate: boolean): Promise<void> {
        this.preGenerateCallback();
        this._models = new BuildingModels([], this.heightParams.minHeight, this.heightParams.heightRange);

        const g = new Graph(this.allStreamlines, this.dstep, true);

        // 1. Find the main city blocks
        this.polygonFinder = new PolygonFinder(g.nodes, this.buildingParams, this.tensorField);
        this.polygonFinder.findPolygons();
        await this.polygonFinder.shrink(animate);

 // CLEAN SIMPLE COURTYARD IMPLEMENTATION

 /**
 * GEOMETRIC DIFFERENCE APPROACH - Much cleaner!
 * Replace the courtyard section in your generate() method
 */

 /**
  * GEOMETRIC DIFFERENCE APPROACH - Much cleaner!
  * Replace the courtyard section in your generate() method
  */

 if (this.buildingMode === 'courtyard') {
     const mainBlocks = this.polygonFinder.polygons.map(p => p.slice());

     // First, create perimeter rings (donut shapes)
     const perimeterRings: Vector[][] = [];

     for (const block of mainBlocks) {
         const blockArea = PolygonUtil.calcPolygonArea(block);

         // Calculate courtyard depth
         const courtyardDepth = Math.min(
             this.courtyardParams.courtyardDepth,
             Math.sqrt(blockArea) * 0.3
         );

         // Skip tiny blocks - just keep them as-is
         if (courtyardDepth < 5 || blockArea < this.buildingParams.minArea * 3) {
             perimeterRings.push(block);
             continue;
         }

         // Create inner courtyard boundary
         const innerBoundary = PolygonUtil.resizeGeometry(block, -courtyardDepth, true);

         if (!innerBoundary || innerBoundary.length < 3) {
             // Can't create courtyard, keep whole block
             perimeterRings.push(block);
             continue;
         }

         // We have a valid perimeter ring, add it
         // Note: We're just storing the outer boundary here
         // The actual "ring" (outer minus inner) will be divided next
         perimeterRings.push(block);
     }

     // Now divide the perimeter rings into lots
     // We'll use a temporary PolygonFinder to divide them
     const tempFinder = new PolygonFinder([], this.buildingParams, this.tensorField);
     tempFinder.polygons.length = 0;
     Array.prototype.push.apply(tempFinder.polygons, perimeterRings);

     // Use the existing divide logic
     await tempFinder.divide(animate);

     // Now filter: keep only lots that are NOT substantially in courtyard centers
     const allDividedLots = tempFinder.polygons;
     const finalLots: Vector[][] = [];

     for (const lot of allDividedLots) {
         const lotCenter = PolygonUtil.averagePoint(lot);
         let keepLot = true;

         // Find which block this lot belongs to
         for (const block of mainBlocks) {
             if (PolygonUtil.insidePolygon(lotCenter, block)) {
                 const blockArea = PolygonUtil.calcPolygonArea(block);
                 const courtyardDepth = Math.min(
                     this.courtyardParams.courtyardDepth,
                     Math.sqrt(blockArea) * 0.3
                 );

                 // Check if block has a courtyard
                 if (courtyardDepth >= 5 && blockArea >= this.buildingParams.minArea * 3) {
                     const innerBoundary = PolygonUtil.resizeGeometry(block, -courtyardDepth, true);

                     if (innerBoundary && innerBoundary.length >= 3) {
                         // Count how many vertices of the lot are inside the courtyard
                         let verticesInside = 0;
                         for (const vertex of lot) {
                             if (PolygonUtil.insidePolygon(vertex, innerBoundary)) {
                                 verticesInside++;
                             }
                         }

                         // Also check the center
                         const centerInside = PolygonUtil.insidePolygon(lotCenter, innerBoundary);

                         // Remove lot if center is inside OR if more than half the vertices are inside
                         if (centerInside || verticesInside > lot.length / 2) {
                             keepLot = false;
                         }
                     }
                 }
                 break; // Found parent block
             }
         }

         if (keepLot) {
             finalLots.push(lot);
         }
     }

     console.log(`Main blocks: ${mainBlocks.length}`);
     console.log(`Total lots after divide: ${allDividedLots.length}`);
     console.log(`Perimeter lots kept: ${finalLots.length}`);
     console.log(`Lots removed: ${allDividedLots.length - finalLots.length} (${((allDividedLots.length - finalLots.length) / allDividedLots.length * 100).toFixed(1)}%)`);

     // Set the final lots
     this.polygonFinder.polygons.length = 0;
     Array.prototype.push.apply(this.polygonFinder.polygons, finalLots);

 } else {
     // Normal divide mode
     await this.polygonFinder.divide(animate);
 }

        this.redraw();

        this._models = new BuildingModels(this.polygonFinder.polygons, this.heightParams.minHeight, this.heightParams.heightRange);

        this.postGenerateCallback();
    }

    setPreGenerateCallback(callback: () => any): void {
        this.preGenerateCallback = callback;
    }

    setPostGenerateCallback(callback: () => any): void {
        this.postGenerateCallback = callback;
    }
    // Helper method for line-line intersection (add this to your Buildings class)
    private lineIntersection(p1: Vector, p2: Vector, p3: Vector, p4: Vector): Vector | null {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 0.0001) return null;

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return new Vector(
                x1 + t * (x2 - x1),
                y1 + t * (y2 - y1)
            );
        }

        return null;
    }
}
