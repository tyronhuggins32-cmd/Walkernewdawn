"use strict";

const canvas=document.querySelector("#game");
const ctx=canvas.getContext("2d");

let SW=innerWidth;
let SH=innerHeight;
let DPR=1;

function resize(){
  SW=innerWidth;
  SH=innerHeight;
  DPR=Math.min(devicePixelRatio||1,2);

  canvas.width=Math.floor(SW*DPR);
  canvas.height=Math.floor(SH*DPR);
  canvas.style.width=SW+"px";
  canvas.style.height=SH+"px";

  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled=false;
}

addEventListener("resize",resize);
resize();

const TILE_W=44;
const TILE_H=22;
const Z_PX=27;
const WORLD_CHUNK=64;
const RENDER_CHUNK=16;
const ROAD=8;
const BUILD_MIN=10;
const BUILD_MAX=62;
const WALK_SPEED=2.05;
const SPRINT_SPEED=4.25;
const WALL_HEIGHT=2.65;

const BUILDING_HEIGHT={
  house:2.65,
  apartment:5.35,
  deli:3.05,
  police:3.35
};

const SPAWN_X=9;
const SPAWN_Y=11;
const camera={
  x:SPAWN_X,
  y:SPAWN_Y
};

let cameraRotation=0;

const CAMERA_VIEW_NAMES=[
  "NORTH EAST",
  "SOUTH EAST",
  "SOUTH WEST",
  "NORTH WEST"
];

function rotateView(dx,dy){
  switch(cameraRotation&3){
    case 1:
      return{
        x:-dy,
        y:dx
      };

    case 2:
      return{
        x:-dx,
        y:-dy
      };

    case 3:
      return{
        x:dy,
        y:-dx
      };

    default:
      return{
        x:dx,
        y:dy
      };
  }
}

function viewToWorld(vx,vy){
  switch(cameraRotation&3){
    case 1:
      return{
        x:vy,
        y:-vx
      };

    case 2:
      return{
        x:-vx,
        y:-vy
      };

    case 3:
      return{
        x:-vy,
        y:vx
      };

    default:
      return{
        x:vx,
        y:vy
      };
  }
}

function viewDepth(x,y){
  const p=rotateView(x,y);
  return p.x+p.y;
}

function frontDirections(){
  switch(cameraRotation&3){
    case 1:
      return[
        [1,0],
        [0,-1]
      ];

    case 2:
      return[
        [-1,0],
        [0,-1]
      ];

    case 3:
      return[
        [-1,0],
        [0,1]
      ];

    default:
      return[
        [1,0],
        [0,1]
      ];
  }
}

function project(x,y,z=0){
  const dx=x-camera.x;
  const dy=y-camera.y;

  const view=rotateView(dx,dy);

  return{
    x:
      SW/2+
      (view.x-view.y)*
      TILE_W/2,

    y:
      SH*.47+
      (view.x+view.y)*
      TILE_H/2-
      z*Z_PX
  };
}

function quad(target,a,b,c,d,color,alpha=1){
  target.save();
  target.globalAlpha=alpha;
  target.fillStyle=color;
  target.beginPath();
  target.moveTo(a.x,a.y);
  target.lineTo(b.x,b.y);
  target.lineTo(c.x,c.y);
  target.lineTo(d.x,d.y);
  target.closePath();
  target.fill();
  target.restore();
}

function diamond(target,point,w,h,color,stroke=null,alpha=1){
  target.save();
  target.globalAlpha=alpha;
  target.fillStyle=color;
  target.beginPath();
  target.moveTo(point.x,point.y);
  target.lineTo(point.x+w/2,point.y+h/2);
  target.lineTo(point.x,point.y+h);
  target.lineTo(point.x-w/2,point.y+h/2);
  target.closePath();
  target.fill();

  if(stroke){
    target.strokeStyle=stroke;
    target.stroke();
  }

  target.restore();
}

const lerpPoint=(a,b,t)=>({
  x:a.x+(b.x-a.x)*t,
  y:a.y+(b.y-a.y)*t
});

const mod=(n,d)=>((n%d)+d)%d;
const cellKey=(x,y)=>x+","+y;

let seedLabel="NEW-DAWN-1993";
let worldSeed=1;

function seedNumber(text){
  let h=2166136261;

  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,16777619);
  }

  h^=h>>>16;
  h=Math.imul(h,2246822507);

  return(h>>>0)||1;
}

function hash(x,y,s=0){
  let h=
    worldSeed^
    Math.imul(x,374761393)^
    Math.imul(y,668265263)^
    Math.imul(s,1442695041);

  h=Math.imul(h^(h>>>16),2246822507);
  h=Math.imul(h^(h>>>13),3266489909);

  return(h^(h>>>16))>>>0;
}

const rand=(x,y,s=0)=>hash(x,y,s)/4294967296;
const mix=(a,b,t)=>a+(b-a)*t;

function noise(x,y,s){
  const x0=Math.floor(x);
  const y0=Math.floor(y);
  const tx=x-x0;
  const ty=y-y0;

  const u=tx*tx*(3-2*tx);
  const v=ty*ty*(3-2*ty);

  return mix(
    mix(rand(x0,y0,s),rand(x0+1,y0,s),u),
    mix(rand(x0,y0+1,s),rand(x0+1,y0+1,s),u),
    v
  );
}

function cityDensity(cx,cy){
  return noise(cx/7,cy/7,11)*.7+
         noise(cx/3,cy/3,12)*.3;
}

function policeBlockAt(cx,cy){
  const sx=Math.floor(cx/6);
  const sy=Math.floor(cy/6);

  return cx===sx*6+hash(sx,sy,20)%6&&
         cy===sy*6+hash(sx,sy,21)%6;
}

function commercialAt(cx,cy){
  return mod(cx+hash(0,Math.floor(cy/9),30)%3,6)===0||
         mod(cy+hash(Math.floor(cx/9),0,31)%3,7)===0;
}

const worldChunks=new Map();
const renderCache=new Map();

let frameNumber=0;

function rectangle(x,y,w,h){
  return{x,y,w,h};
}

function cellsInRect(r){
  const result=[];

  for(let y=r.y;y<r.y+r.h;y++){
    for(let x=r.x;x<r.x+r.w;x++){
      result.push([x,y]);
    }
  }

  return result;
}

function paintGround(chunk,r,type){
  for(const[x,y]of cellsInRect(r)){
    chunk.ground.set(cellKey(x,y),type);
  }
}

function addSolid(chunk,x,y){
  chunk.solid.add(cellKey(x,y));
}

function addProp(chunk,kind,x,y,w=1,h=1,solid=false,extra={}){
  const prop={kind,x,y,w,h,anim:0,...extra};

  chunk.props.push(prop);

  if(solid){
    for(let py=y;py<y+h;py++){
      for(let px=x;px<x+w;px++){
        addSolid(chunk,px,py);
      }
    }
  }

  return prop;
}

function floorFor(type){
  return type==="house"
    ?"wood"
    :type==="apartment"
      ?"carpet"
      :type==="deli"
        ?"store"
        :"police";
}

function wallFor(type){
  return type==="house"
    ?"brick"
    :type==="apartment"
      ?"plaster"
      :type==="deli"
        ?"storeWall"
        :"policeWall";
}

function addWall(chunk,building,x,y,exterior=false,type=building.wallType){
  if(!building.cells.has(cellKey(x,y)))return;

  chunk.walls.set(cellKey(x,y),{
    type,
    height:building.wallHeight,
    exterior,
    bid:building.uid,
    window:
      exterior&&
      hash(
        chunk.cx*WORLD_CHUNK+x,
        chunk.cy*WORLD_CHUNK+y,
        91
      )%3!==0
  });

  addSolid(chunk,x,y);
}

function removeWall(chunk,x,y){
  chunk.walls.delete(cellKey(x,y));
  chunk.solid.delete(cellKey(x,y));
}

function wallLineH(chunk,building,y,x1,x2,gap){
  for(let x=x1;x<=x2;x++){
    if(x!==gap){
      addWall(chunk,building,x,y,false);
    }
  }
}

function wallLineV(chunk,building,x,y1,y2,gap){
  for(let y=y1;y<=y2;y++){
    if(y!==gap){
      addWall(chunk,building,x,y,false);
    }
  }
}

function preferredDoor(building,side){
  const direction=
    side==="top"
      ?[0,-1]
      :side==="bottom"
        ?[0,1]
        :side==="left"
          ?[-1,0]
          :[1,0];

  const cells=[...building.cells].map(
    k=>k.split(",").map(Number)
  );

  const centerX=
    cells.reduce((n,c)=>n+c[0],0)/
    cells.length;

  const centerY=
    cells.reduce((n,c)=>n+c[1],0)/
    cells.length;

  const candidates=cells.filter(([x,y])=>
    !building.cells.has(
      cellKey(
        x+direction[0],
        y+direction[1]
      )
    )
  );

  candidates.sort((a,b)=>
    side==="top"||side==="bottom"
      ?Math.abs(a[0]-centerX)-Math.abs(b[0]-centerX)
      :Math.abs(a[1]-centerY)-Math.abs(b[1]-centerY)
  );

  return candidates[0];
}

function sideVector(side){
  return side==="top"
    ?[0,-1]
    :side==="bottom"
      ?[0,1]
      :side==="left"
        ?[-1,0]
        :[1,0];
}

function buildEntrancePath(chunk,building,x,y,side){
  const[dx,dy]=sideVector(side);

  const pathType=
    building.type==="house"
      ?"sidewalk"
      :"pavement";

  let px=x+dx;
  let py=y+dy;

  for(let step=0;step<12;step++){
    if(
      px<0||
      py<0||
      px>=WORLD_CHUNK||
      py>=WORLD_CHUNK||
      building.cells.has(cellKey(px,py))
    )break;

    chunk.ground.set(
      cellKey(px,py),
      pathType
    );

    if(
      px<BUILD_MIN||
      py<BUILD_MIN||
      px>=BUILD_MAX||
      py>=BUILD_MAX
    )break;

    px+=dx;
    py+=dy;
  }
}

function addDoor(chunk,building,x,y,side){
  removeWall(chunk,x,y);

  building.doors.push({x,y,side});

  addProp(chunk,"door",x,y,1,1,false,{
    side,
    bid:building.uid,
    buildingType:building.type
  });

  buildEntrancePath(
    chunk,
    building,
    x,
    y,
    side
  );
}

function buildRoof(building){
  building.roofTiles=building.parts.map((part,index)=>
    building.type==="house"
      ?{
          x:part.x-.24,
          y:part.y-.24,
          w:part.w+.48,
          h:part.h+.48,
          z:building.wallHeight+.1,
          pitched:true,
          index
        }
      :{
          ...part,
          z:building.wallHeight+.12,
          flat:true,
          index
        }
  );
}

function addCompoundBuilding(chunk,parts,type,id,doorSide){
  const cells=new Set();

  for(const part of parts){
    for(const[x,y]of cellsInRect(part)){
      cells.add(cellKey(x,y));
    }
  }

  const building={
    uid:chunk.cx+","+chunk.cy+":"+id,
    id,
    type,
    parts,
    cells,
    doors:[],
    wallType:wallFor(type),
    wallHeight:BUILDING_HEIGHT[type]||WALL_HEIGHT,
    roofTiles:[],
    roofAlpha:1
  };

  chunk.buildings.push(building);

  for(const k of cells){
    const[x,y]=k.split(",").map(Number);

    chunk.floors.set(k,floorFor(type));

    const outside=[
      [1,0],[-1,0],[0,1],[0,-1]
    ].some(([dx,dy])=>
      !cells.has(cellKey(x+dx,y+dy))
    );

    if(outside){
      addWall(chunk,building,x,y,true);
    }
  }

  const door=preferredDoor(building,doorSide);

  if(door){
    addDoor(
      chunk,
      building,
      door[0],
      door[1],
      doorSide
    );
  }

  buildRoof(building);

  return building;
}

function setFloor(chunk,r,type){
  for(const[x,y]of cellsInRect(r)){
    if(chunk.floors.has(cellKey(x,y))){
      chunk.floors.set(cellKey(x,y),type);
    }
  }
}

function furnishHouse(chunk,b,anchorX,anchorY){
  wallLineV(
    chunk,b,
    anchorX+6,
    anchorY+1,
    anchorY+11,
    anchorY+6
  );

  wallLineH(
    chunk,b,
    anchorY+7,
    anchorX+1,
    anchorX+10,
    anchorX+4
  );

  addProp(chunk,"bed",anchorX+2,anchorY+2,2,3,true,{bid:b.uid});
  addProp(chunk,"dresser",anchorX+4,anchorY+2,1,2,true,{bid:b.uid});
  addProp(chunk,"sofa",anchorX+2,anchorY+9,3,1,true,{bid:b.uid});
  addProp(chunk,"rug",anchorX+2,anchorY+7,4,3,false,{bid:b.uid});
  addProp(chunk,"kitchen",anchorX+8,anchorY+2,2,4,true,{bid:b.uid});
  addProp(chunk,"table",anchorX+8,anchorY+8,2,2,true,{bid:b.uid});
  addProp(chunk,"stairs",anchorX+7,anchorY+12,2,3,true,{bid:b.uid});
}

function makeHouse(chunk,lot,doorSide,salt){
  const variant=hash(
    chunk.cx,
    chunk.cy,
    salt
  )%3;

  let parts;
  let anchorX;
  let anchorY;

  if(variant===0){
    anchorX=lot.x+4;
    anchorY=lot.y+4;

    parts=[
      rectangle(anchorX,anchorY,13,15),
      rectangle(anchorX+10,anchorY+8,6,7)
    ];
  }else if(variant===1){
    anchorX=lot.x+7;
    anchorY=lot.y+4;

    parts=[
      rectangle(anchorX,anchorY,13,15),
      rectangle(anchorX-3,anchorY+8,6,7)
    ];
  }else{
    anchorX=lot.x+5;
    anchorY=lot.y+6;

    parts=[
      rectangle(anchorX,anchorY,16,12),
      rectangle(anchorX+5,anchorY-3,7,6)
    ];
  }

  const b=addCompoundBuilding(
    chunk,
    parts,
    "house",
    salt,
    doorSide
  );

  furnishHouse(
    chunk,
    b,
    anchorX,
    anchorY
  );

  const d=b.doors[0];

  if(d){
    const ox=
      d.side==="left"
        ?-2
        :d.side==="right"
          ?1
          :-1;

    const oy=
      d.side==="top"
        ?-2
        :d.side==="bottom"
          ?1
          :-1;

    addProp(
      chunk,
      "porch",
      d.x+ox,
      d.y+oy,
      d.side==="left"||d.side==="right"?2:3,
      d.side==="top"||d.side==="bottom"?2:3,
      false,
      {bid:b.uid}
    );
  }

  return b;
}

function generateResidential(chunk){
  paintGround(
    chunk,
    rectangle(BUILD_MIN,BUILD_MIN,52,52),
    "grass"
  );

  const size=26;
  let id=1;

  for(let gx=0;gx<2;gx++){
    for(let gy=0;gy<2;gy++){
      const lot=rectangle(
        BUILD_MIN+gx*size,
        BUILD_MIN+gy*size,
        size,
        size
      );

      const side=gy===0?"top":"bottom";

      makeHouse(
        chunk,
        lot,
        side,
        100+id++
      );

      if(rand(chunk.cx,chunk.cy,300+id)>.42){
        addProp(
          chunk,
          "tree",
          lot.x+(gx?20:4),
          lot.y+(gy?5:20),
          1,
          1,
          true
        );
      }
    }
  }
}

function generateApartments(chunk){
  paintGround(
    chunk,
    rectangle(BUILD_MIN,BUILD_MIN,52,52),
    "pavement"
  );

  paintGround(
    chunk,
    rectangle(24,23,16,27),
    "courtyard"
  );

  const parts=[
    rectangle(14,13,10,37),
    rectangle(14,13,36,10),
    rectangle(40,13,10,37)
  ];

  const b=addCompoundBuilding(
    chunk,
    parts,
    "apartment",
    1,
    "top"
  );

  for(const x of[19,45]){
    wallLineV(chunk,b,x,14,48,22);

    wallLineH(
      chunk,b,30,
      x===19?15:41,
      x===19?23:49,
      x===19?18:46
    );

    addProp(chunk,"stairs",x===19?16:43,17,2,4,true,{bid:b.uid});
    addProp(chunk,"bed",x===19?16:43,25,2,3,true,{bid:b.uid});
    addProp(chunk,"sofa",x===19?20:46,35,2,1,true,{bid:b.uid});
  }

  wallLineH(chunk,b,18,24,39,31);
  wallLineV(chunk,b,31,14,22,17);

  addProp(chunk,"mail",28,16,3,1,true,{bid:b.uid});
  addProp(chunk,"rug",27,18,8,3,false,{bid:b.uid});

  addProp(chunk,"balcony",26,11.8,4,1.2,false,{
    bid:b.uid,
    baseZ:2.58
  });

  addProp(chunk,"balcony",34,11.8,4,1.2,false,{
    bid:b.uid,
    baseZ:2.58
  });

  addProp(chunk,"bench",27,31,3,1,true);
  addProp(chunk,"bench",35,39,3,1,true);
  addProp(chunk,"tree",32,36,1,1,true);

  for(let x=16;x<49;x+=8){
    if(rand(chunk.cx,chunk.cy,400+x)>.45){
      addProp(chunk,"car",x,54,2,4,true);
    }
  }
}

function furnishDeli(chunk,b,x,y){
  wallLineH(
    chunk,b,
    y+7,
    x+1,
    x+15,
    x+12
  );

  setFloor(
    chunk,
    rectangle(x+1,y+1,15,6),
    "backroom"
  );

  for(let sx=x+3;sx<x+14;sx+=4){
    addProp(
      chunk,
      "shelf",
      sx,
      y+10,
      1,
      5,
      true,
      {bid:b.uid}
    );
  }

  addProp(chunk,"counter",x+2,y+16,5,1,true,{bid:b.uid});
  addProp(chunk,"cooler",x+14,y+10,1,6,true,{bid:b.uid});
  addProp(chunk,"freezer",x+2,y+2,4,3,true,{bid:b.uid});
}

function makeDeli(chunk,lot,doorSide,id){
  const x=lot.x+4;
  const y=lot.y+3;

  const parts=[
    rectangle(x,y,17,16),
    rectangle(x+9,y+13,10,8)
  ];

  const b=addCompoundBuilding(
    chunk,
    parts,
    "deli",
    id,
    doorSide
  );

  furnishDeli(chunk,b,x,y);

  const d=b.doors[0];

  if(d){
    addProp(
      chunk,
      "awning",
      d.x,
      d.y,
      1,
      1,
      false,
      {side:d.side,bid:b.uid}
    );
  }

  addProp(chunk,"crate",x+12,y+18,2,2,true);

  return b;
}

function makeSmallApartment(chunk,lot,doorSide,id){
  const x=lot.x+5;
  const y=lot.y+3;

  const parts=[
    rectangle(x,y,16,19),
    rectangle(x-3,y+7,6,10)
  ];

  const b=addCompoundBuilding(
    chunk,
    parts,
    "apartment",
    id,
    doorSide
  );

  wallLineH(chunk,b,y+8,x+1,x+14,x+7);
  wallLineV(chunk,b,x+8,y+1,y+17,y+12);

  addProp(chunk,"bed",x+2,y+2,2,3,true,{bid:b.uid});
  addProp(chunk,"bed",x+11,y+10,2,3,true,{bid:b.uid});
  addProp(chunk,"sofa",x+2,y+12,3,1,true,{bid:b.uid});
  addProp(chunk,"kitchen",x+11,y+2,2,4,true,{bid:b.uid});
  addProp(chunk,"stairs",x+6,y+14,2,3,true,{bid:b.uid});

  addProp(
    chunk,
    "balcony",
    x+6,
    doorSide==="top"?y-1:y+18.8,
    4,
    1.2,
    false,
    {bid:b.uid,baseZ:2.58}
  );

  return b;
}

function generateMixed(chunk){
  paintGround(
    chunk,
    rectangle(BUILD_MIN,BUILD_MIN,52,52),
    "pavement"
  );

  const deli=hash(chunk.cx,chunk.cy,500)%4;
  let id=1;

  for(let gx=0;gx<2;gx++){
    for(let gy=0;gy<2;gy++){
      const index=gy+gx*2;

      const lot=rectangle(
        BUILD_MIN+gx*26,
        BUILD_MIN+gy*26,
        26,
        26
      );

      const side=gy===0?"top":"bottom";

      if(index===deli){
        makeDeli(chunk,lot,side,id++);
      }else if(rand(chunk.cx,chunk.cy,520+index)>.32){
        makeSmallApartment(chunk,lot,side,id++);
      }else{
        makeHouse(chunk,lot,side,600+id++);
      }
    }
  }
}

function generatePolice(chunk){
  paintGround(
    chunk,
    rectangle(BUILD_MIN,BUILD_MIN,52,52),
    "parking"
  );

  const parts=[
    rectangle(14,13,34,18),
    rectangle(14,29,18,16),
    rectangle(36,29,12,16)
  ];

  const b=addCompoundBuilding(
    chunk,
    parts,
    "police",
    1,
    "top"
  );

  wallLineH(chunk,b,21,15,47,31);
  wallLineV(chunk,b,25,14,44,20);
  wallLineV(chunk,b,39,14,44,34);
  wallLineH(chunk,b,36,15,31,20);
  wallLineH(chunk,b,36,37,47,43);

  addProp(chunk,"desk",17,16,4,2,true,{bid:b.uid});
  addProp(chunk,"desk",27,16,4,2,true,{bid:b.uid});
  addProp(chunk,"bench",38,17,6,1,true,{bid:b.uid});
  addProp(chunk,"locker",16,39,7,1,true,{bid:b.uid});
  addProp(chunk,"evidence",27,39,3,2,true,{bid:b.uid});
  addProp(chunk,"bars",42,32,1,10,true,{bid:b.uid});
  addProp(chunk,"policeSign",27,13,8,1,false,{bid:b.uid});
  addProp(chunk,"garageDoor",39,44,7,1,false,{bid:b.uid});

  for(let x=16;x<58;x+=7){
    if(rand(chunk.cx,chunk.cy,700+x)>.28){
      addProp(chunk,"policeCar",x,50,2,4,true);
    }
  }

  for(let x=13;x<51;x++){
    if(x<31||x>33){
      addProp(chunk,"fence",x,47,1,1,true);
    }
  }

  addProp(chunk,"gate",31,47,3,1,false);
}

function generateWorldChunk(cx,cy){
  const chunk={
    cx,
    cy,
    district:"residential",
    ground:new Map(),
    floors:new Map(),
    walls:new Map(),
    solid:new Set(),
    props:[],
    buildings:[]
  };

  if(policeBlockAt(cx,cy)){
    chunk.district="police precinct";
    generatePolice(chunk);
  }else if(commercialAt(cx,cy)){
    chunk.district="mixed use";
    generateMixed(chunk);
  }else if(cityDensity(cx,cy)>.57){
    chunk.district="apartment complex";
    generateApartments(chunk);
  }else{
    generateResidential(chunk);
  }

  return chunk;
}

function getWorldChunk(cx,cy){
  const k=cellKey(cx,cy);

  if(!worldChunks.has(k)){
    worldChunks.set(
      k,
      generateWorldChunk(cx,cy)
    );
  }

  return worldChunks.get(k);
}

function worldCell(gx,gy){
  const cx=Math.floor(gx/WORLD_CHUNK);
  const cy=Math.floor(gy/WORLD_CHUNK);
  const lx=mod(gx,WORLD_CHUNK);
  const ly=mod(gy,WORLD_CHUNK);

  const chunk=getWorldChunk(cx,cy);
  const k=cellKey(lx,ly);

  let ground;

  if(lx<ROAD||ly<ROAD){
    ground="road";
  }else if(
    lx<BUILD_MIN||
    ly<BUILD_MIN||
    lx>=BUILD_MAX||
    ly>=BUILD_MAX
  ){
    ground="sidewalk";
  }else{
    ground=chunk.ground.get(k)||"pavement";
  }

  return{
    ground,
    floor:chunk.floors.get(k)||null,
    cx,
    cy,
    lx,
    ly
  };
}

const GROUND={
  road:["#202427","#1d2123"],
  sidewalk:["#686a65","#60625e"],
  grass:["#324c31","#2c452c"],
  pavement:["#3c403d","#383b39"],
  courtyard:["#3c5138","#354a34"],
  parking:["#303436","#2c3032"]
};

const FLOORS={
  wood:["#8a745b","#806b54"],
  carpet:["#66645d","#5f5d57"],
  store:["#797365","#716b5e"],
  police:["#687477","#616c6f"],
  backroom:["#5d5b55","#56544f"]
};

function makeLayerCanvas(width,height){
  if(typeof OffscreenCanvas!=="undefined"){
    return new OffscreenCanvas(width,height);
  }

  const layer=document.createElement("canvas");
  layer.width=width;
  layer.height=height;

  return layer;
}

function cachePoint(x,y){
  return{
    x:(x-y)*TILE_W/2+
      RENDER_CHUNK*TILE_W/2+8,
    y:(x+y)*TILE_H/2+8
  };
}

function cachedDiamond(layer,x,y,color,stroke=null){
  diamond(
    layer,
    cachePoint(x,y),
    TILE_W,
    TILE_H,
    color,
    stroke
  );
}

function buildRenderChunk(rx,ry){
  const width=RENDER_CHUNK*TILE_W+16;
  const height=RENDER_CHUNK*TILE_H+18;

  const layer=makeLayerCanvas(width,height);
  const g=layer.getContext("2d");

  g.imageSmoothingEnabled=false;

  const startX=rx*RENDER_CHUNK;
  const startY=ry*RENDER_CHUNK;

  for(let sum=0;sum<=2*(RENDER_CHUNK-1);sum++){
    for(let ly=0;ly<RENDER_CHUNK;ly++){
      const lx=sum-ly;

      if(lx<0||lx>=RENDER_CHUNK)continue;

      const gx=startX+lx;
      const gy=startY+ly;
      const cell=worldCell(gx,gy);
      const variation=hash(gx,gy,800)%2;

      cachedDiamond(
        g,lx,ly,
        GROUND[cell.ground][variation],
        "rgba(8,10,9,.15)"
      );

      if(cell.floor){
        cachedDiamond(
          g,lx,ly-.02,
          FLOORS[cell.floor][variation],
          "rgba(20,20,18,.22)"
        );

        const p=cachePoint(lx+.5,ly+.5);

        g.fillStyle="rgba(255,255,255,.07)";
        g.fillRect(p.x-1,p.y-1,2,2);
      }

      if(cell.ground==="road"){
        g.strokeStyle="rgba(176,163,82,.72)";
        g.lineWidth=2;

        if(cell.lx===3&&cell.ly>=ROAD){
          const a=cachePoint(lx+.5,ly);
          const b=cachePoint(lx+.5,ly+1);

          g.beginPath();
          g.moveTo(a.x,a.y);
          g.lineTo(b.x,b.y);
          g.stroke();
        }

        if(cell.ly===3&&cell.lx>=ROAD){
          const a=cachePoint(lx,ly+.5);
          const b=cachePoint(lx+1,ly+.5);

          g.beginPath();
          g.moveTo(a.x,a.y);
          g.lineTo(b.x,b.y);
          g.stroke();
        }
      }
    }
  }

  return{
    canvas:layer,
    last:frameNumber
  };
}

function getRenderChunk(rx,ry){
  const k=cellKey(rx,ry);

  if(!renderCache.has(k)){
    renderCache.set(
      k,
      buildRenderChunk(rx,ry)
    );
  }

  const cached=renderCache.get(k);
  cached.last=frameNumber;

  return cached.canvas;
}

function drawCachedChunk(rx,ry){
  const layer=getRenderChunk(rx,ry);

  const origin=project(
    rx*RENDER_CHUNK,
    ry*RENDER_CHUNK,
    0
  );

  ctx.drawImage(
    layer,
    Math.round(
      origin.x-
      RENDER_CHUNK*TILE_W/2-
      8
    ),
    Math.round(origin.y-8)
  );
}

function pruneCaches(){
  if(renderCache.size>90){
    const oldest=[...renderCache]
      .sort((a,b)=>a[1].last-b[1].last)
      .slice(0,renderCache.size-72);

    for(const[k]of oldest){
      renderCache.delete(k);
    }
  }

  if(worldChunks.size>50){
    const pcx=Math.floor(player.x/WORLD_CHUNK);
    const pcy=Math.floor(player.y/WORLD_CHUNK);

    for(const[k,c]of worldChunks){
      if(
        Math.abs(c.cx-pcx)>4||
        Math.abs(c.cy-pcy)>4
      ){
        worldChunks.delete(k);
      }
    }
  }
}

const player={
  x:SPAWN_X,
  y:SPAWN_Y,
  w:.62,
  h:.62,
  stamina:100,
  moving:false,
  facing:"down",
  step:0
};

const keys={};

let touchX=0;
let touchY=0;
let touchRun=false;
let started=false;
let playing=false;

function isSolid(tx,ty){
  const cx=Math.floor(tx/WORLD_CHUNK);
  const cy=Math.floor(ty/WORLD_CHUNK);
  const lx=mod(tx,WORLD_CHUNK);
  const ly=mod(ty,WORLD_CHUNK);

  return getWorldChunk(cx,cy)
    .solid
    .has(cellKey(lx,ly));
}

function collisionAt(x,y){
  const l=Math.floor(x-player.w/2);
  const r=Math.floor(x+player.w/2-.001);
  const t=Math.floor(y-player.h/2);
  const b=Math.floor(y+player.h/2-.001);

  for(let ty=t;ty<=b;ty++){
    for(let tx=l;tx<=r;tx++){
      if(isSolid(tx,ty)){
        return true;
      }
    }
  }

  return false;
}

addEventListener("keydown",e=>{
  if(e.key==="Escape"&&started){
    openMenu();
    return;
  }

  if(playing){
    keys[e.key.toLowerCase()]=true;
  }
});

addEventListener("keyup",e=>{
  keys[e.key.toLowerCase()]=false;
});

addEventListener("blur",()=>{
  for(const k in keys){
    keys[k]=false;
  }

  touchX=0;
  touchY=0;
  touchRun=false;
});

function findBuildingAt(x,y){
  const cx=Math.floor(x/WORLD_CHUNK);
  const cy=Math.floor(y/WORLD_CHUNK);
  const lx=Math.floor(mod(x,WORLD_CHUNK));
  const ly=Math.floor(mod(y,WORLD_CHUNK));

  return getWorldChunk(cx,cy)
    .buildings
    .find(b=>b.cells.has(cellKey(lx,ly)))||null;
}

function update(dt){
  let screenDX=
    (keys.d||keys.arrowright?1:0)-
    (keys.a||keys.arrowleft?1:0)+
    touchX;

  let screenDY=
    (keys.s||keys.arrowdown?1:0)-
    (keys.w||keys.arrowup?1:0)+
    touchY;

  let worldDX=screenDY+screenDX;
  let worldDY=screenDY-screenDX;

  const length=Math.hypot(worldDX,worldDY);

  if(length>0){
    worldDX/=length;
    worldDY/=length;
  }

  const running=
    (keys.shift||touchRun)&&
    player.stamina>0&&
    length>.05;

  const speed=running
    ?SPRINT_SPEED
    :WALK_SPEED;

  player.moving=length>.05;

  if(running){
    player.stamina=Math.max(
      0,
      player.stamina-22*dt
    );
  }else{
    player.stamina=Math.min(
      100,
      player.stamina+11*dt
    );
  }

  if(player.moving){
    player.step+=dt*speed*5;

    player.facing=
      Math.abs(screenDX)>Math.abs(screenDY)
        ?screenDX>0?"right":"left"
        :screenDY>0?"down":"up";
  }

  const nx=player.x+worldDX*speed*dt;
  const ny=player.y+worldDY*speed*dt;

  if(!collisionAt(nx,player.y)){
    player.x=nx;
  }

  if(!collisionAt(player.x,ny)){
    player.y=ny;
  }

  camera.x+=
    (player.x-camera.x)*
    Math.min(1,dt*7);

  camera.y+=
    (player.y-camera.y)*
    Math.min(1,dt*7);

  document.querySelector("#stamina").style.width=
    player.stamina+"%";

  const cx=Math.floor(player.x/WORLD_CHUNK);
  const cy=Math.floor(player.y/WORLD_CHUNK);
  const chunk=getWorldChunk(cx,cy);

  document.querySelector("#area").textContent=
    "NEW DAWN CITY • "+
    chunk.district.toUpperCase();
}

const WALL_COLORS={
  brick:{top:"#765a47",east:"#493529",south:"#5b4032"},
  plaster:{top:"#85837a",east:"#4d4d49",south:"#62615b"},
  storeWall:{top:"#827969",east:"#48433b",south:"#60584d"},
  policeWall:{top:"#637985",east:"#34464e",south:"#465d67"},
  fence:{top:"#8a8d87",east:"#4f5451",south:"#676c68"}
};

const ROOF_COLORS={
  house:["#5d4740","#684e45","#75584b"],
  apartment:["#494b4a","#545655","#5c5d59"],
  deli:["#514b43","#5e574d","#686054"],
  police:["#3f4b51","#48565c","#53636a"]
};

function tileCorners(x,y,z){
  return[
    project(x,y,z),
    project(x+1,y,z),
    project(x+1,y+1,z),
    project(x,y+1,z)
  ];
}

function windowOnFace(topA,topB,baseB,baseA,alpha,start=.3,end=.69){
  const upperLeft=lerpPoint(topA,baseA,start);
  const upperRight=lerpPoint(topB,baseB,start);
  const lowerRight=lerpPoint(topB,baseB,end);
  const lowerLeft=lerpPoint(topA,baseA,end);

  const a=lerpPoint(upperLeft,upperRight,.16);
  const b=lerpPoint(upperLeft,upperRight,.84);
  const c=lerpPoint(lowerLeft,lowerRight,.84);
  const d=lerpPoint(lowerLeft,lowerRight,.16);

  quad(ctx,a,b,c,d,"#71959c",alpha);

  const topMid=lerpPoint(a,b,.5);
  const bottomMid=lerpPoint(d,c,.5);
  const leftMid=lerpPoint(a,d,.5);
  const rightMid=lerpPoint(b,c,.5);
  const shine=lerpPoint(a,c,.32);

  ctx.save();
  ctx.globalAlpha=alpha*.82;
  ctx.strokeStyle="#263337";
  ctx.lineWidth=1.25;
  ctx.beginPath();
  ctx.moveTo(a.x,a.y);
  ctx.lineTo(b.x,b.y);
  ctx.lineTo(c.x,c.y);
  ctx.lineTo(d.x,d.y);
  ctx.closePath();
  ctx.moveTo(topMid.x,topMid.y);
  ctx.lineTo(bottomMid.x,bottomMid.y);
  ctx.moveTo(leftMid.x,leftMid.y);
  ctx.lineTo(rightMid.x,rightMid.y);
  ctx.stroke();
  ctx.fillStyle="#d1dedb";
  ctx.fillRect(shine.x-1,shine.y-1,3,2);
  ctx.restore();
}

function floorBand(topA,topB,baseB,baseA,alpha){
  const a=lerpPoint(topA,baseA,.485);
  const b=lerpPoint(topB,baseB,.485);
  const c=lerpPoint(topB,baseB,.515);
  const d=lerpPoint(topA,baseA,.515);

  quad(ctx,a,b,c,d,"#303433",alpha*.62);
}

function foundationBand(topA,topB,baseB,baseA,height,alpha){
  const start=1-Math.min(.16,.3/height);
  const a=lerpPoint(topA,baseA,start);
  const b=lerpPoint(topB,baseB,start);

  quad(ctx,a,b,baseB,baseA,"#303331",alpha*.9);
}

function drawWallItem(item){
  const height=item.type==="fence"
    ?1.05
    :item.height||WALL_HEIGHT;

  const base=tileCorners(item.x,item.y,0);
  const top=tileCorners(item.x,item.y,height);
  const colors=WALL_COLORS[item.type]||WALL_COLORS.plaster;
  const alpha=item.alpha;

  quad(ctx,top[1],top[2],base[2],base[1],colors.east,alpha);
  quad(ctx,top[2],top[3],base[3],base[2],colors.south,alpha);
  quad(ctx,top[0],top[1],top[2],top[3],colors.top,alpha);

  if(item.type!=="fence"){
    foundationBand(top[1],top[2],base[2],base[1],height,alpha);
    foundationBand(top[2],top[3],base[3],base[2],height,alpha);
  }

  if(item.window&&height>4.4){
    windowOnFace(top[1],top[2],base[2],base[1],alpha,.15,.38);
    windowOnFace(top[2],top[3],base[3],base[2],alpha,.15,.38);
    windowOnFace(top[1],top[2],base[2],base[1],alpha,.6,.82);
    windowOnFace(top[2],top[3],base[3],base[2],alpha,.6,.82);
    floorBand(top[1],top[2],base[2],base[1],alpha);
    floorBand(top[2],top[3],base[3],base[2],alpha);
  }else if(item.window&&height>1.2){
    windowOnFace(top[1],top[2],base[2],base[1],alpha);
    windowOnFace(top[2],top[3],base[3],base[2],alpha);
  }
}

function roofTriangle(a,b,c,color,alpha){
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(a.x,a.y);
  ctx.lineTo(b.x,b.y);
  ctx.lineTo(c.x,c.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPitchedRoof(item){
  const{x,y,w,h,z,alpha}=item;
  const rise=Math.min(2.35,Math.min(w,h)*.2);
  const palette=ROOF_COLORS.house;
  const dark=palette[0];
  const light=palette[2];
  const fascia="#493831";

  let outlines=[];

  if(w<=h){
    const l0=project(x,y,z);
    const l1=project(x,y+h,z);
    const r0=project(x+w,y,z);
    const r1=project(x+w,y+h,z);
    const n=project(x+w/2,y,z+rise);
    const s=project(x+w/2,y+h,z+rise);

    quad(ctx,l0,n,s,l1,dark,alpha);
    quad(ctx,n,r0,r1,s,light,alpha);
    roofTriangle(l1,s,r1,fascia,alpha);

    outlines=[l0,n,r0,r1,s,l1,l0];
  }else{
    const t0=project(x,y,z);
    const t1=project(x+w,y,z);
    const b0=project(x,y+h,z);
    const b1=project(x+w,y+h,z);
    const l=project(x,y+h/2,z+rise);
    const r=project(x+w,y+h/2,z+rise);

    quad(ctx,t0,t1,r,l,dark,alpha);
    quad(ctx,l,r,b1,b0,light,alpha);
    roofTriangle(t1,r,b1,fascia,alpha);

    outlines=[t0,t1,r,b1,b0,l,t0];
  }

  ctx.save();
  ctx.globalAlpha=alpha*.8;
  ctx.strokeStyle="#251f1c";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(outlines[0].x,outlines[0].y);

  for(let i=1;i<outlines.length;i++){
    ctx.lineTo(outlines[i].x,outlines[i].y);
  }

  ctx.stroke();
  ctx.restore();
}

function drawRoofItem(item){
  if(item.pitched){
    drawPitchedRoof(item);
    return;
  }

  const w=item.w||1;
  const h=item.h||1;

  const top=[
    project(item.x,item.y,item.z),
    project(item.x+w,item.y,item.z),
    project(item.x+w,item.y+h,item.z),
    project(item.x,item.y+h,item.z)
  ];

  const lower=[
    project(item.x,item.y,item.z-.12),
    project(item.x+w,item.y,item.z-.12),
    project(item.x+w,item.y+h,item.z-.12),
    project(item.x,item.y+h,item.z-.12)
  ];

  const palette=ROOF_COLORS[item.buildingType];
  const color=palette[hash(item.x,item.y,910)%palette.length];

  quad(ctx,top[1],top[2],lower[2],lower[1],"#302d2a",item.alpha);
  quad(ctx,top[2],top[3],lower[3],lower[2],"#3a3531",item.alpha);
  quad(ctx,top[0],top[1],top[2],top[3],color,item.alpha);

  ctx.save();
  ctx.globalAlpha=item.alpha*.45;
  ctx.strokeStyle="#1d2222";
  ctx.lineWidth=item.flat?2:1;
  ctx.beginPath();
  ctx.moveTo(top[0].x,top[0].y);

  for(let i=1;i<4;i++){
    ctx.lineTo(top[i].x,top[i].y);
  }

  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  if(item.flat&&w>8&&h>8){
    const edge={
      top:"#667075",
      east:"#30383b",
      south:"#465055"
    };

    prism(item.x,item.y,w,.22,.28,edge,item.alpha,item.z+.01);
    prism(item.x,item.y,.22,h,.28,edge,item.alpha,item.z+.01);
    prism(item.x,item.y+h-.22,w,.22,.28,edge,item.alpha,item.z+.01);
    prism(item.x+w-.22,item.y,.22,h,.28,edge,item.alpha,item.z+.01);

    const unitX=item.x+w*.38;
    const unitY=item.y+h*.37;

    prism(
      unitX,
      unitY,
      Math.min(2.4,w*.18),
      Math.min(2,h*.18),
      .48,
      {
        top:"#767c79",
        east:"#3c4341",
        south:"#565d5a"
      },
      item.alpha,
      item.z+.02
    );
  }
}

function prism(x,y,w,h,height,colors,alpha=1,baseZ=0){
  const base=[
    project(x,y,baseZ),
    project(x+w,y,baseZ),
    project(x+w,y+h,baseZ),
    project(x,y+h,baseZ)
  ];

  const top=[
    project(x,y,baseZ+height),
    project(x+w,y,baseZ+height),
    project(x+w,y+h,baseZ+height),
    project(x,y+h,baseZ+height)
  ];

  quad(ctx,top[1],top[2],base[2],base[1],colors.east,alpha);
  quad(ctx,top[2],top[3],base[3],base[2],colors.south,alpha);
  quad(ctx,top[0],top[1],top[2],top[3],colors.top,alpha);
}

const PROP_STYLE={
  bed:{h:.42,top:"#8d7e6e",east:"#51483f",south:"#695d50"},
  dresser:{h:.9,top:"#72543c",east:"#3d2c21",south:"#543d2c"},
  sofa:{h:.72,top:"#75675c",east:"#403933",south:"#554a42"},
  rug:{h:.025,top:"#59484c",east:"#352b2e",south:"#44373a"},
  kitchen:{h:1.02,top:"#888072",east:"#4a463f",south:"#676057"},
  table:{h:.76,top:"#795d43",east:"#413123",south:"#5a4431"},
  stairs:{h:.55,top:"#77736b",east:"#41403d",south:"#5a5752"},
  mail:{h:1.05,top:"#686b67",east:"#383b39",south:"#4d504d"},
  shelf:{h:1.48,top:"#71573f",east:"#3b2d21",south:"#55412f"},
  counter:{h:.92,top:"#735b45",east:"#3d3025",south:"#554434"},
  cooler:{h:1.45,top:"#829398",east:"#455257",south:"#62747a"},
  freezer:{h:.86,top:"#89999b",east:"#4a5557",south:"#687779"},
  crate:{h:.75,top:"#816447",east:"#443524",south:"#604a35"},
  desk:{h:.78,top:"#6d5541",east:"#3b2e24",south:"#514031"},
  bench:{h:.58,top:"#74563d",east:"#3d2d21",south:"#57402f"},
  locker:{h:1.55,top:"#637176",east:"#354045",south:"#4a585d"},
  evidence:{h:1.24,top:"#646b61",east:"#363b35",south:"#4a5149"},
  bars:{h:1.5,top:"#929997",east:"#505654",south:"#6d7471"},
  balcony:{h:.16,top:"#777a75",east:"#3d403e",south:"#575a56"},
  porch:{h:.14,top:"#80664e",east:"#46372b",south:"#604b3a"},
  dumpster:{h:1.1,top:"#3d5648",east:"#223329",south:"#2e4137"}
};

function drawDoorProp(item){
  const prop=item.prop;
  const open=prop.anim;
  const side=prop.side;
  const type=prop.buildingType;
  const[outX,outY]=sideVector(side);

  let fx=item.x;
  let fy=item.y;
  let fex=item.x+1;
  let fey=item.y;

  if(side==="bottom"){
    fy++;
    fey=fy;
  }else if(side==="left"){
    fex=fx;
    fey=fy+1;
  }else if(side==="right"){
    fx++;
    fex=fx;
    fey=fy+1;
  }

  let stepX=item.x-.2;
  let stepY=item.y-.2;
  let stepW=1.4;
  let stepH=1.4;

  if(side==="top"){
    stepY=item.y-.78;
    stepH=.78;
  }else if(side==="bottom"){
    stepY=item.y+1;
    stepH=.78;
  }else if(side==="left"){
    stepX=item.x-.78;
    stepW=.78;
  }else{
    stepX=item.x+1;
    stepW=.78;
  }

  prism(
    stepX,
    stepY,
    stepW,
    stepH,
    .12,
    {
      top:"#a39d8d",
      east:"#4d4a44",
      south:"#716d64"
    }
  );

  const frameA=project(fx,fy,0);
  const frameB=project(fex,fey,0);
  const frameAT=project(fx,fy,2.02);
  const frameBT=project(fex,fey,2.02);

  const frameColor=
    type==="police"
      ?"#d5dfe0"
      :type==="deli"
        ?"#d2bd72"
        :type==="apartment"
          ?"#bab7aa"
          :"#c7b79d";

  ctx.save();
  ctx.strokeStyle="#171b1b";
  ctx.lineWidth=8;
  ctx.beginPath();
  ctx.moveTo(frameA.x,frameA.y);
  ctx.lineTo(frameAT.x,frameAT.y);
  ctx.lineTo(frameBT.x,frameBT.y);
  ctx.lineTo(frameB.x,frameB.y);
  ctx.stroke();

  ctx.strokeStyle=frameColor;
  ctx.lineWidth=4;
  ctx.stroke();
  ctx.restore();

  if(type!=="deli"){
    const canopyA=project(fx,fy,2.18);
    const canopyB=project(fex,fey,2.18);
    const canopyC=project(fex+outX*.72,fey+outY*.72,2.03);
    const canopyD=project(fx+outX*.72,fy+outY*.72,2.03);

    quad(
      ctx,
      canopyA,canopyB,canopyC,canopyD,
      type==="police"
        ?"#718995"
        :type==="apartment"
          ?"#555b59"
          :"#6e503e",
      1
    );
  }

  let hx=fx;
  let hy=fy;
  let ex=fex;
  let ey=fey;

  if(open>0){
    if(side==="top"||side==="bottom"){
      ex=hx+Math.cos(open*Math.PI/2);
      ey=hy+(side==="top"?1:-1)*Math.sin(open*Math.PI/2);
    }else{
      ex=hx+(side==="left"?1:-1)*Math.sin(open*Math.PI/2);
      ey=hy+Math.cos(open*Math.PI/2);
    }
  }

  const a=project(hx,hy,0);
  const b=project(ex,ey,0);
  const bt=project(ex,ey,1.9);
  const at=project(hx,hy,1.9);

  const doorColor=
    type==="police"
      ?"#405d69"
      :type==="deli"
        ?"#8e493e"
        :type==="apartment"
          ?"#5c5147"
          :"#704a32";

  quad(ctx,at,bt,b,a,doorColor,1);

  ctx.strokeStyle="#211915";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(at.x,at.y);
  ctx.lineTo(bt.x,bt.y);
  ctx.lineTo(b.x,b.y);
  ctx.stroke();

  const knob=lerpPoint(
    project(hx,hy,.92),
    project(ex,ey,.92),
    .82
  );

  ctx.fillStyle="#d8bf69";
  ctx.beginPath();
  ctx.arc(knob.x,knob.y,2.2,0,Math.PI*2);
  ctx.fill();

  const lampA=project(fx,fy,1.72);
  const lampB=project(fex,fey,1.72);

  for(const lamp of[lampA,lampB]){
    const glow=ctx.createRadialGradient(
      lamp.x,lamp.y,1,
      lamp.x,lamp.y,12
    );

    glow.addColorStop(0,"rgba(255,224,144,.72)");
    glow.addColorStop(1,"rgba(255,205,100,0)");

    ctx.fillStyle=glow;
    ctx.beginPath();
    ctx.arc(lamp.x,lamp.y,12,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle="#e3c778";
    ctx.fillRect(lamp.x-2,lamp.y-2,4,4);
  }

  if(type==="deli"){
    const awnZ=1.72;
    const aa=project(fx,fy,awnZ);
    const bb=project(fex,fey,awnZ);
    const cc=project(fex+outX*.76,fey+outY*.76,awnZ-.14);
    const dd=project(fx+outX*.76,fy+outY*.76,awnZ-.14);

    quad(ctx,aa,bb,cc,dd,"#9b4c42",1);

    const label=project(item.x+.5,item.y+.5,2.45);

    ctx.save();
    ctx.fillStyle="#202523";
    ctx.fillRect(label.x-31,label.y-8,62,15);
    ctx.strokeStyle="#d4c77c";
    ctx.strokeRect(label.x-31,label.y-8,62,15);
    ctx.fillStyle="#eee4ba";
    ctx.font="bold 8px Arial";
    ctx.textAlign="center";
    ctx.fillText("NEW DAWN DELI",label.x,label.y+2);
    ctx.restore();
  }

  const marker=project(
    item.x+.5+outX*.72,
    item.y+.5+outY*.72,
    .16
  );

  const pulse=.72+Math.sin(performance.now()*.006)*.18;

  ctx.save();
  ctx.globalAlpha=pulse;
  ctx.fillStyle="#d7c66e";
  ctx.beginPath();
  ctx.arc(marker.x,marker.y,4,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawBalcony(item){
  const p=item.prop;
  const z=p.baseZ||2.58;

  prism(item.x,item.y,p.w,p.h,.16,PROP_STYLE.balcony,1,z);

  const low=[
    project(item.x,item.y,z+.16),
    project(item.x+p.w,item.y,z+.16),
    project(item.x+p.w,item.y+p.h,z+.16),
    project(item.x,item.y+p.h,z+.16)
  ];

  const high=[
    project(item.x,item.y,z+.88),
    project(item.x+p.w,item.y,z+.88),
    project(item.x+p.w,item.y+p.h,z+.88),
    project(item.x,item.y+p.h,z+.88)
  ];

  ctx.save();
  ctx.strokeStyle="#4d5351";
  ctx.lineWidth=2;
  ctx.beginPath();

  for(const i of[1,2,3]){
    ctx.moveTo(low[i].x,low[i].y);
    ctx.lineTo(high[i].x,high[i].y);
  }

  ctx.moveTo(high[1].x,high[1].y);
  ctx.lineTo(high[2].x,high[2].y);
  ctx.lineTo(high[3].x,high[3].y);
  ctx.stroke();
  ctx.restore();
}

function drawGarageDoor(item){
  const p=item.prop;
  const y=item.y+1;

  const a=project(item.x,y,0);
  const b=project(item.x+p.w,y,0);
  const bt=project(item.x+p.w,y,2.65);
  const at=project(item.x,y,2.65);

  quad(ctx,at,bt,b,a,"#59666a",1);

  ctx.save();
  ctx.strokeStyle="#30383b";
  ctx.lineWidth=2;

  for(let i=1;i<7;i++){
    const l=lerpPoint(at,a,i/7);
    const r=lerpPoint(bt,b,i/7);

    ctx.beginPath();
    ctx.moveTo(l.x,l.y);
    ctx.lineTo(r.x,r.y);
    ctx.stroke();
  }

  const wa=lerpPoint(at,a,.22);
  const wb=lerpPoint(bt,b,.22);
  const wc=lerpPoint(bt,b,.42);
  const wd=lerpPoint(at,a,.42);

  quad(ctx,wa,wb,wc,wd,"#78959b",1);
  ctx.restore();
}

function drawPoliceSign(item){
  const p=item.prop;
  const y=item.y+1.02;

  const a=project(item.x,y,1.95);
  const b=project(item.x+p.w,y,1.95);
  const bt=project(item.x+p.w,y,2.72);
  const at=project(item.x,y,2.72);

  quad(ctx,at,bt,b,a,"#d2d7d5",1);

  const mid=project(item.x+p.w/2,y,2.34);

  ctx.save();
  ctx.translate(mid.x,mid.y);
  ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
  ctx.fillStyle="#263c48";
  ctx.font="bold 12px Arial";
  ctx.textAlign="center";
  ctx.fillText("POLICE",0,4);
  ctx.restore();
}

function drawGate(item){
  const p=item.prop;
  const y=item.y+.5;

  const a=project(item.x,y,0);
  const b=project(item.x+p.w,y,0);
  const at=project(item.x,y,1.15);
  const bt=project(item.x+p.w,y,1.15);

  ctx.save();
  ctx.strokeStyle="#737b78";
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(a.x,a.y);
  ctx.lineTo(at.x,at.y);
  ctx.lineTo(bt.x,bt.y);
  ctx.lineTo(b.x,b.y);

  ctx.moveTo(
    lerpPoint(a,at,.45).x,
    lerpPoint(a,at,.45).y
  );

  ctx.lineTo(
    lerpPoint(b,bt,.45).x,
    lerpPoint(b,bt,.45).y
  );

  ctx.stroke();
  ctx.restore();
}

function drawTree(item,time){
  const base=project(item.x+.5,item.y+.5,0);
  const sway=Math.sin(time*.0015+item.x*.7+item.y)*4;

  ctx.fillStyle="rgba(0,0,0,.32)";
  ctx.beginPath();
  ctx.ellipse(base.x+13,base.y+4,25,10,.2,0,Math.PI*2);
  ctx.fill();

  ctx.strokeStyle="#493522";
  ctx.lineWidth=7;
  ctx.beginPath();
  ctx.moveTo(base.x,base.y);
  ctx.lineTo(base.x+sway*.35,base.y-51);
  ctx.stroke();

  for(const[ox,oy,r,c]of[
    [0,-58,29,"#294b2c"],
    [-18,-49,22,"#356039"],
    [18,-48,21,"#203f26"],
    [sway,-70,18,"#426d43"]
  ]){
    ctx.fillStyle=c;
    ctx.beginPath();
    ctx.arc(base.x+ox+sway,base.y+oy,r,0,Math.PI*2);
    ctx.fill();
  }
}

function drawVehicle(item,police){
  const style={
    top:police
      ?"#d5d8d3"
      :["#5b6265","#704640","#40524c","#3e5260"][
        hash(item.x,item.y,950)%4
      ],
    east:"#252b2e",
    south:"#3a4143"
  };

  prism(item.x,item.y,2,4,.78,style);

  prism(
    item.x+.22,
    item.y+.9,
    1.56,
    2.15,
    .55,
    {
      top:"#314047",
      east:"#172126",
      south:"#253238"
    },
    1,
    .78
  );

  if(police){
    prism(
      item.x+.75,
      item.y+1.75,
      .5,
      .5,
      .14,
      {
        top:"#b94a43",
        east:"#315b8a",
        south:"#315b8a"
      },
      1,
      1.34
    );
  }
}

function drawPropItem(item,time){
  const p=item.prop;

  if(p.kind==="door"){
    drawDoorProp(item);
    return;
  }

  if(p.kind==="tree"){
    drawTree(item,time);
    return;
  }

  if(p.kind==="car"||p.kind==="policeCar"){
    drawVehicle(item,p.kind==="policeCar");
    return;
  }

  if(p.kind==="balcony"){
    drawBalcony(item);
    return;
  }

  if(p.kind==="garageDoor"){
    drawGarageDoor(item);
    return;
  }

  if(p.kind==="policeSign"){
    drawPoliceSign(item);
    return;
  }

  if(p.kind==="gate"){
    drawGate(item);
    return;
  }

  if(p.kind==="awning")return;

  if(p.kind==="fence"){
    drawWallItem({
      x:item.x,
      y:item.y,
      type:"fence",
      alpha:1,
      window:false
    });

    return;
  }

  const style=PROP_STYLE[p.kind]||PROP_STYLE.crate;

  prism(
    item.x,
    item.y,
    p.w,
    p.h,
    style.h,
    style,
    1,
    p.baseZ||0
  );

  if(p.kind==="stairs"){
    for(let i=0;i<3;i++){
      prism(
        item.x,
        item.y+i*p.h/3,
        p.w,
        p.h/3,
        .16+i*.12,
        {
          top:"#8d887e",
          east:"#44423e",
          south:"#64615b"
        }
      );
    }
  }
}

function drawPlayerItem(){
  const p=project(player.x,player.y,0);
  const walk=player.moving?Math.sin(player.step)*6:0;

  ctx.fillStyle="rgba(0,0,0,.45)";
  ctx.beginPath();
  ctx.ellipse(p.x+5,p.y+3,13,6,.15,0,Math.PI*2);
  ctx.fill();

  ctx.strokeStyle="#25282b";
  ctx.lineWidth=5;
  ctx.beginPath();
  ctx.moveTo(p.x-3,p.y-19);
  ctx.lineTo(p.x-6-walk*.25,p.y-2);
  ctx.moveTo(p.x+3,p.y-19);
  ctx.lineTo(p.x+7+walk*.25,p.y-2);
  ctx.stroke();

  ctx.fillStyle="#4e5c62";
  ctx.fillRect(p.x-8,p.y-40,16,22);

  ctx.fillStyle="#718087";
  ctx.fillRect(p.x-7,p.y-39,14,4);

  ctx.strokeStyle="#9f7455";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(p.x-7,p.y-36);
  ctx.lineTo(p.x-12+walk*.2,p.y-21);
  ctx.moveTo(p.x+7,p.y-36);
  ctx.lineTo(p.x+12-walk*.2,p.y-21);
  ctx.stroke();

  ctx.fillStyle="#aa7d5d";
  ctx.beginPath();
  ctx.arc(p.x,p.y-48,7,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle="#211b18";
  ctx.fillRect(p.x-7,p.y-55,14,5);
}

function activeBuilding(){
  return findBuildingAt(player.x,player.y);
}

function visibleBounds(){
  const radius=
    Math.ceil(Math.max(SW/TILE_W,SH/TILE_H))+12;

  return{
    minX:Math.floor(player.x-radius),
    maxX:Math.ceil(player.x+radius),
    minY:Math.floor(player.y-radius),
    maxY:Math.ceil(player.y+radius)
  };
}

function gatherDynamic(bounds,dt){
  const active=activeBuilding();
  const items=[];

  const minCX=Math.floor(bounds.minX/WORLD_CHUNK);
  const maxCX=Math.floor(bounds.maxX/WORLD_CHUNK);
  const minCY=Math.floor(bounds.minY/WORLD_CHUNK);
  const maxCY=Math.floor(bounds.maxY/WORLD_CHUNK);

  for(let cy=minCY;cy<=maxCY;cy++){
    for(let cx=minCX;cx<=maxCX;cx++){
      const chunk=getWorldChunk(cx,cy);
      const ox=cx*WORLD_CHUNK;
      const oy=cy*WORLD_CHUNK;

      for(const building of chunk.buildings){
        const target=
          active?.uid===building.uid
            ?.02
            :1;

        building.roofAlpha+=
          (target-building.roofAlpha)*
          Math.min(1,dt*7);

        if(building.roofAlpha>.025){
          for(const tile of building.roofTiles){
            const gx=ox+tile.x;
            const gy=oy+tile.y;
            const w=tile.w||1;
            const h=tile.h||1;

            if(
              gx<=bounds.maxX+2&&
              gx+w>=bounds.minX-2&&
              gy<=bounds.maxY+2&&
              gy+h>=bounds.minY-2
            ){
              items.push({
                kind:"roof",
                x:gx,
                y:gy,
                w,
                h,
                z:tile.z,
                flat:tile.flat,
                pitched:tile.pitched,
                alpha:building.roofAlpha,
                buildingType:building.type,
                sort:(gx+gy+(w+h)*.52)*100+4
              });
            }
          }
        }
      }

      for(const[k,data]of chunk.walls){
        const[lx,ly]=k.split(",").map(Number);
        const gx=ox+lx;
        const gy=oy+ly;

        if(
          gx<bounds.minX-2||
          gx>bounds.maxX+2||
          gy<bounds.minY-2||
          gy>bounds.maxY+2
        )continue;

        const foreground=
          active?.uid===data.bid&&
          gx+gy>player.x+player.y+.5;

        items.push({
          kind:"wall",
          x:gx,
          y:gy,
          ...data,
          alpha:foreground?.06:1,
          sort:(gx+gy)*100+2
        });
      }

      for(const prop of chunk.props){
        const gx=ox+prop.x;
        const gy=oy+prop.y;

        if(
          gx<bounds.minX-5||
          gx>bounds.maxX+5||
          gy<bounds.minY-5||
          gy>bounds.maxY+5
        )continue;

        if(prop.kind==="door"){
          const distance=Math.hypot(
            player.x-(gx+.5),
            player.y-(gy+.5)
          );

          const target=distance<1.35?1:0;

          prop.anim+=
            (target-prop.anim)*
            Math.min(1,dt*9);
        }

        items.push({
          kind:"prop",
          x:gx,
          y:gy,
          prop,
          sort:(gx+gy+(prop.w+prop.h)*.45)*100+3
        });
      }
    }
  }

  items.push({
    kind:"player",
    x:player.x,
    y:player.y,
    sort:(player.x+player.y)*100+3.5
  });

  items.sort((a,b)=>a.sort-b.sort);

  return items;
}

function playerOccludedByRoof(items){
  const playerItem=items.find(
    item=>item.kind==="player"
  );

  const p=project(player.x,player.y,0);

  const body={
    left:p.x-14,
    right:p.x+14,
    top:p.y-58,
    bottom:p.y+5
  };

  if(!playerItem)return false;

  for(const roof of items){
    if(
      roof.kind!=="roof"||
      roof.alpha<.92||
      roof.sort<=playerItem.sort
    )continue;

    const points=[
      project(roof.x,roof.y,roof.z),
      project(roof.x+roof.w,roof.y,roof.z),
      project(roof.x+roof.w,roof.y+roof.h,roof.z),
      project(roof.x,roof.y+roof.h,roof.z)
    ];

    if(roof.pitched){
      const rise=Math.min(
        2.35,
        Math.min(roof.w,roof.h)*.2
      );

      if(roof.w<=roof.h){
        points.push(
          project(roof.x+roof.w/2,roof.y,roof.z+rise),
          project(roof.x+roof.w/2,roof.y+roof.h,roof.z+rise)
        );
      }else{
        points.push(
          project(roof.x,roof.y+roof.h/2,roof.z+rise),
          project(roof.x+roof.w,roof.y+roof.h/2,roof.z+rise)
        );
      }
    }

    const box={
      left:Math.min(...points.map(v=>v.x)),
      right:Math.max(...points.map(v=>v.x)),
      top:Math.min(...points.map(v=>v.y)),
      bottom:
        Math.max(...points.map(v=>v.y))+
        WALL_HEIGHT*Z_PX
    };

    if(
      body.right>box.left&&
      body.left<box.right&&
      body.bottom>box.top&&
      body.top<box.bottom
    ){
      return true;
    }
  }

  return false;
}

function drawEntranceOverlays(time,bounds){
  const active=activeBuilding();
  const candidates=[];

  const minCX=Math.floor(bounds.minX/WORLD_CHUNK);
  const maxCX=Math.floor(bounds.maxX/WORLD_CHUNK);
  const minCY=Math.floor(bounds.minY/WORLD_CHUNK);
  const maxCY=Math.floor(bounds.maxY/WORLD_CHUNK);

  for(let cy=minCY;cy<=maxCY;cy++){
    for(let cx=minCX;cx<=maxCX;cx++){
      const chunk=getWorldChunk(cx,cy);
      const ox=cx*WORLD_CHUNK;
      const oy=cy*WORLD_CHUNK;

      for(const building of chunk.buildings){
        if(active?.uid===building.uid)continue;

        for(const door of building.doors){
          const gx=ox+door.x+.5;
          const gy=oy+door.y+.5;

          const distance=Math.hypot(
            player.x-gx,
            player.y-gy
          );

          if(distance<12){
            candidates.push({
              building,
              door,
              gx,
              gy,
              distance
            });
          }
        }
      }
    }
  }

  candidates.sort((a,b)=>a.distance-b.distance);

  for(const entry of candidates.slice(0,2)){
    const extra=
      entry.building.type==="house"
        ?2.65
        :.8;

    const anchor=project(
      entry.gx,
      entry.gy,
      entry.building.wallHeight+extra
    );

    const alpha=Math.min(
      1,
      (12-entry.distance)/3
    );

    const pulse=
      1+Math.sin(time*.006+entry.gx)*.08;

    const label=
      entry.building.type.toUpperCase()+
      " ENTRANCE";

    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(anchor.x,anchor.y);
    ctx.scale(pulse,pulse);
    ctx.fillStyle="#d5c36f";
    ctx.beginPath();
    ctx.moveTo(0,8);
    ctx.lineTo(7,-2);
    ctx.lineTo(3,-2);
    ctx.lineTo(3,-10);
    ctx.lineTo(-3,-10);
    ctx.lineTo(-3,-2);
    ctx.lineTo(-7,-2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.font="bold 9px Arial";
    ctx.textAlign="center";

    const width=Math.max(
      82,
      ctx.measureText(label).width+18
    );

    ctx.fillStyle="#101514e8";
    ctx.fillRect(anchor.x-width/2,anchor.y-32,width,17);
    ctx.strokeStyle="#c8bc73";
    ctx.strokeRect(anchor.x-width/2,anchor.y-32,width,17);
    ctx.fillStyle="#eee9cf";
    ctx.fillText(label,anchor.x,anchor.y-20);
    ctx.restore();
  }
}

function drawScene(dt,time){
  frameNumber++;

  ctx.fillStyle="#0a0d0e";
  ctx.fillRect(0,0,SW,SH);

  const bounds=visibleBounds();

  const minRX=Math.floor(bounds.minX/RENDER_CHUNK);
  const maxRX=Math.floor(bounds.maxX/RENDER_CHUNK);
  const minRY=Math.floor(bounds.minY/RENDER_CHUNK);
  const maxRY=Math.floor(bounds.maxY/RENDER_CHUNK);
  const layers=[];

  for(let ry=minRY;ry<=maxRY;ry++){
    for(let rx=minRX;rx<=maxRX;rx++){
      layers.push({
        rx,
        ry,
        sort:rx+ry
      });
    }
  }

  layers.sort((a,b)=>a.sort-b.sort);

  for(const layer of layers){
    drawCachedChunk(layer.rx,layer.ry);
  }

  const items=gatherDynamic(bounds,dt);
  const hidePlayer=playerOccludedByRoof(items);

  for(const item of items){
    if(item.kind==="wall"){
      drawWallItem(item);
    }else if(item.kind==="roof"){
      drawRoofItem(item);
    }else if(item.kind==="prop"){
      drawPropItem(item,time);
    }else if(!hidePlayer){
      drawPlayerItem();
    }
  }

  const vignette=ctx.createRadialGradient(
    SW/2,
    SH*.46,
    Math.min(SW,SH)*.18,
    SW/2,
    SH*.48,
    Math.max(SW,SH)*.68
  );

  vignette.addColorStop(0,"rgba(0,0,0,0)");
  vignette.addColorStop(1,"rgba(0,0,0,.38)");

  ctx.fillStyle=vignette;
  ctx.fillRect(0,0,SW,SH);

  drawEntranceOverlays(time,bounds);

  if(frameNumber%120===0){
    pruneCaches();
  }

  document.querySelector("#renderView").textContent=
    `16M CHUNKS • ${renderCache.size} CACHED • ${worldChunks.size} WORLD`;
}

const menu=document.querySelector("#menu");
const seedInput=document.querySelector("#seed");
const continueButton=document.querySelector("#continue");

function resetWorld(){
  worldChunks.clear();
  renderCache.clear();

  player.x=SPAWN_X;
  player.y=SPAWN_Y;
  player.stamina=100;
  player.step=0;

  camera.x=player.x;
  camera.y=player.y;

  for(const k in keys){
    keys[k]=false;
  }
}

function generateCity(){
  seedLabel=
    seedInput.value.trim()||
    randomSeed();

  seedInput.value=seedLabel;
  worldSeed=seedNumber(seedLabel);

  resetWorld();

  started=true;
  playing=true;

  menu.classList.add("hidden");
  document.body.classList.add("playing");
  continueButton.hidden=false;

  document.querySelector("#seedView").textContent=
    "SEED • "+seedLabel;

  try{
    localStorage.setItem(
      "wnd-iso-seed",
      seedLabel
    );

    const url=new URL(location.href);
    url.searchParams.set("seed",seedLabel);
    history.replaceState(null,"",url);
  }catch{}
}

function openMenu(){
  if(!started)return;

  playing=false;
  menu.classList.remove("hidden");
  document.body.classList.remove("playing");
}

function resumeGame(){
  if(!started)return;

  playing=true;
  menu.classList.add("hidden");
  document.body.classList.add("playing");
  previousTime=performance.now();
}

function randomSeed(){
  const values=new Uint32Array(1);

  if(globalThis.crypto?.getRandomValues){
    globalThis.crypto.getRandomValues(values);
  }else{
    values[0]=Date.now();
  }

  return"NDC-"+
    values[0]
      .toString(36)
      .toUpperCase()
      .padStart(7,"0");
}

document.querySelector("#start").onclick=generateCity;

document.querySelector("#random").onclick=()=>{
  seedInput.value=randomSeed();
  seedInput.focus();
  seedInput.select();
};

document.querySelector("#menuBtn").onclick=openMenu;
continueButton.onclick=resumeGame;

seedInput.onkeydown=e=>{
  e.stopPropagation();

  if(e.key==="Enter"){
    generateCity();
  }
};

try{
  seedInput.value=
    new URL(location.href).searchParams.get("seed")||
    localStorage.getItem("wnd-iso-seed")||
    seedLabel;
}catch{
  seedInput.value=seedLabel;
}

seedInput.focus();
seedInput.select();

const joystick=document.querySelector("#joy");
const stick=document.querySelector("#stick");
const runButton=document.querySelector("#run");

let joyPointer=null;

function moveJoy(e){
  const r=joystick.getBoundingClientRect();
  const x=e.clientX-(r.left+r.width/2);
  const y=e.clientY-(r.top+r.height/2);
  const m=Math.hypot(x,y);
  const limit=38;
  const scale=m>limit?limit/m:1;

  touchX=x*scale/limit;
  touchY=y*scale/limit;

  stick.style.transform=
    `translate(${x*scale}px,${y*scale}px)`;
}

joystick.addEventListener("pointerdown",e=>{
  joyPointer=e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  moveJoy(e);
});

joystick.addEventListener("pointermove",e=>{
  if(e.pointerId===joyPointer){
    moveJoy(e);
  }
});

function stopJoy(e){
  if(
    joyPointer!==null&&
    (!e||e.pointerId===joyPointer)
  ){
    joyPointer=null;
    touchX=0;
    touchY=0;
    stick.style.transform="";
  }
}

joystick.addEventListener("pointerup",stopJoy);
joystick.addEventListener("pointercancel",stopJoy);

runButton.addEventListener("pointerdown",e=>{
  touchRun=true;
  runButton.setPointerCapture(e.pointerId);
});

runButton.addEventListener("pointerup",()=>{
  touchRun=false;
});

runButton.addEventListener("pointercancel",()=>{
  touchRun=false;
});

let previousTime=performance.now();

function gameLoop(time){
  const dt=Math.min(
    .05,
    (time-previousTime)/1000
  );

  previousTime=time;

  if(started){
    if(playing){
      update(dt);
    }

    drawScene(dt,time);
  }else{
    ctx.fillStyle="#090c0d";
    ctx.fillRect(0,0,SW,SH);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

globalThis.WalkerNewDawn={
  generateSeed(seed){
    seedInput.value=String(seed);
    generateCity();
  },

  getScale(){
    return{
      projection:"dimetric",
      worldChunkMeters:64,
      renderChunkMeters:16,
      roadMeters:8,
      walkMetersPerSecond:WALK_SPEED,
      sprintMetersPerSecond:SPRINT_SPEED
    };
  },

  getChunk(cx,cy){
    const c=getWorldChunk(cx,cy);

    return{
      district:c.district,
      buildings:c.buildings.map(b=>({
        type:b.type,
        parts:b.parts.map(p=>({...p})),
        floorCells:b.cells.size
      }))
    };
  },

  getRenderStats(){
    return{
      worldChunks:worldChunks.size,
      cachedRenderChunks:renderCache.size
    };
  }
};
