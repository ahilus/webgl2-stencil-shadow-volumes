
var gl;
var canvas;
var mymenu;

var simpleProg,billboardProg,lightProg,lightcProg,ambientProg,ambientcProg,shadowFrontProg,shadowBackProg,shadowSideProg;


var projMat=mat4.create();
var infProjMat=mat4.create();
var viewMat=mat4.create();
var viewProjMat=mat4.create();
var viewInfProjMat=mat4.create();


var blaMat=mat4.create();
mat4.identity(blaMat);
var billboardMesh;
var scene={};

var teapotMesh;
var teapotShdMesh;
var groundMesh;

var teapotMtrl={"shininess" : 32, "color" : [1.0,1.0,1.0]};
var groundMtrl={"shininess" : 128,  "color" : [1.0,1.0,1.0]};


var calcFPS=createFpsCounter();


var cameraControl=createFreeLookCameraControl5({"pos":[0,2,14],"yaw":0,"pitch":0,"speed":50,"slow":5,"lookSpeed":0.005});


function setErrorMsg(msg) {
    var root=document.getElementById("root");
    root.innerHTML=hasError?root.innerHTML:'';
    hasError=true;
    root.innerHTML+='<pre>'+msg.replace("\n","<br/>");+'</pre>';
}

var addLog=(function(){
    var logElement; return (function(msg){
        logElement=logElement||document.getElementById("log");
        var m=document.createElement('span');
        m.innerHTML=msg.replace("\n","<br/>");
        var e=document.createElement('span');
        logElement.appendChild(document.createElement('br'));
        logElement.appendChild(m);
        logElement.appendChild(e);
        return (function bla(x){e.innerHTML=x.replace("\n","<br/>");return bla});
    });
})();

var updateBarFps=(function(){
    var element; return (function(x){
        element=element||document.getElementById("barFps");
        element.innerHTML = x.toFixed(1)  + " fps";
    });
})();

var updateBarTime=(function(){
    var element; return (function(x){
        element=element||document.getElementById("barTime");
        element.innerHTML = x.toFixed(2);
    });
})();

function calcObjTransform(obj,projMat,infProjMat,viewMat) {
    if(obj.invModelMat) {
        mat4.invert(obj.invModelMat,obj.modelMat); //invModelMat
    }

    if(obj.modelViewMat) {
        mat4.multiply(obj.modelViewMat,viewMat,obj.modelMat); //modelViewMat

        if(obj.normalMat) {
            mat3.normalFromMat4(obj.normalMat,obj.modelViewMat); //normalMat
        }

        if(obj.modelViewProjMat) {
            mat4.multiply(obj.modelViewProjMat,projMat,obj.modelViewMat); //modelViewProjMat
        }

        if(obj.modelViewInfProjMat) {
            mat4.multiply(obj.modelViewInfProjMat,infProjMat,obj.modelViewMat); //modelViewInfProjMat
        }
    }
}

function doMesh(posData,norData,texData,indData) {
    var vao=createGeometry([0,3,posData],[1,3,norData],[2,2,texData],indData);
    return {"indsNum":indData.length,"vao":vao};
}

function initMenu() {
    var gui = new dat.GUI();
    mymenu =  {
        "sceneName":'teapot',
        "sceneAnimate":false,

        "shadowFace": 'back',
        "shadowDebugVolume":false,
        "shadowDebugWireframe":false,
        "shadowZ":'fail',
        "cameraYaw":0,
        "cameraPitch":0.5,
        "cameraDist":15,
        "lightX":-1,
        "lightY":4.5,
        "lightZ":2,
        "groundY":0,
        "groundScale":1,
        "groundVisible":true,
        "disableShadows":false,
    };

    gui.add(mymenu, 'sceneAnimate').name('animate');

    var f1 = gui.addFolder('Shadow');
    f1.add(mymenu, 'shadowFace', ['front', 'back'] ).name('face');
    f1.add(mymenu, 'shadowZ', ['pass', 'fail'] ).name('z');
    f1.add(mymenu, 'shadowDebugVolume').name('show volume');
    f1.add(mymenu, 'shadowDebugWireframe').name('show wireframe');
    f1.add(mymenu, 'disableShadows').name('disable shadows');
   
    var f3 = gui.addFolder('Light');
    f3.add(mymenu, 'lightX', -5, 5).name('x');
    f3.add(mymenu, 'lightY', 0, 10).name('y');
    f3.add(mymenu, 'lightZ', -5, 5).name('z');

    var f4 = gui.addFolder('Ground');
    f4.add(mymenu, 'groundY',-5,0).name('y');
    f4.add(mymenu, 'groundScale',1,5).name('scale');
    f4.add(mymenu, 'groundVisible').name('visible');

    var f2 = gui.addFolder('Camera');
    f2.add(mymenu, 'cameraYaw', -3.14, 3.14).name('yaw');
    f2.add(mymenu, 'cameraPitch', 0.1, 1.57).name('pitch');
    f2.add(mymenu, 'cameraDist', 2, 55).name('distance');

    f1.open();
    f2.open();
    f3.open();
    f4.open();
}

function onInit2() {
    //
    scene.ground={
        "modelMat" : mat4.create(),
        "invModelMat" : mat4.create(),
        "modelViewMat" : mat4.create(),
        "normalMat" : mat3.create(),
        "modelViewProjMat" : mat4.create(),
        "modelViewInfProjMat" : mat4.create()
    };

    scene.teapot={
        "modelMat" : mat4.create(),
        "invModelMat" : mat4.create(),
        "modelViewMat" : mat4.create(),
        "normalMat" : mat3.create(),
        "modelViewProjMat" : mat4.create(),
        "modelViewInfProjMat" : mat4.create(),
    };

    scene.light={
        "modelMat" : mat4.create(),
        "modelViewMat" : mat4.create(),
        "modelViewProjMat" : mat4.create(),
        "pos" : vec4.fromValues(-1,4.5,2,1),
        "viewPos" : vec4.create()
    };

    billboardMesh={"vao":createGeometry([0,2,[-1,-1, 1,-1, -1,1 ,1,1]],null)};

    loadText("models/teapot.obj").then(function(objStr){
        var objMesh = new OBJ.Mesh(objStr);
        var posData=new Float32Array(objMesh.vertices);
        var norData=new Float32Array(objMesh.vertexNormals);
        var texData=new Float32Array(objMesh.textures);
        var indData=new Uint32Array(objMesh.indices);

        teapotMesh=doMesh(posData,norData,texData,indData);
        teapotShdMesh=doShadowMesh(posData,indData);
        gl.bindVertexArray(null);
    },log);

    //
    loadText("models/plane.obj").then(function(objStr){
        var objMesh = new OBJ.Mesh(objStr);
        var posData=new Float32Array(objMesh.vertices);
        var norData=new Float32Array(objMesh.vertexNormals);
        var texData=new Float32Array(objMesh.textures);
        var indData=new Uint32Array(objMesh.indices);
        groundMesh=doMesh(posData,norData,texData,indData);

        gl.bindVertexArray(null);
    },log);



    //

    loadTexture2d(gl,"models/grid.png",gl.RGB, gl.RGB, gl.UNSIGNED_BYTE,false,true,true).then(function(tex) {
        groundMtrl.colTex=tex;
    },log);




    //
    getProgram(gl,"shaders/shadowSide.vs","shaders/shadow.fs").then(function(prog) {shadowSideProg=prog;},log);
    getProgram(gl,"shaders/shadowFront.vs","shaders/shadow.fs").then(function(prog) {shadowFrontProg=prog;},log);
    getProgram(gl,"shaders/shadowBack.vs","shaders/shadow.fs").then(function(prog) {shadowBackProg=prog;},log);

    getProgram(gl,"shaders/light.vs","shaders/light.fs").then(function(prog) {lightProg=prog;},log);
    getProgram(gl,"shaders/light_wtex.vs","shaders/light_wtex.fs").then(function(prog) {lightcProg=prog;},log);
    getProgram(gl,"shaders/simple.vs","shaders/white.fs").then(function(prog) {simpleProg=prog;},log);
    getProgram(gl,"shaders/billboard.vs","shaders/billboard.fs").then(function(prog) {billboardProg=prog;},log);
    getProgram(gl,"shaders/ambient.vs","shaders/ambient.fs").then(function(prog) {ambientProg=prog;},log);
    getProgram(gl,"shaders/ambient_wtex.vs","shaders/ambient_wtex.fs").then(function(prog) {ambientcProg=prog;},log);

    //
    uniform3f(gl,"u_lightAtten",0.9,0.1,0.01);
    uniform3f(gl,"u_lightCol",1.0,1.0,1.0);
    uniform3f(gl,"u_ambientCol",0.3,0.3,0.3);
    uniform1i(gl,"u_colMap",0);
}



function depthStates() {
    setDrawStates(gl,true,{
        "depth_test":true,
        "cull_face":true,
        "color_writemask":[false,false,false,false]
    });
}

function shadowStates() {
    setDrawStates(gl,true,{
        "depth_test":true,
        "stencil_test":true,
        "depth_writemask":false,
        "color_writemask":[false,false,false,false],
        "stencil_func":gl.ALWAYS,
        "stencil_ref":0x0,
        "stencil_valuemask":0xff,


        //  "stencil_writemask":0xff,
    });

    if(mymenu.shadowZ=='pass') {
        setDrawStates(gl,false,{
            "stencil_fail":gl.KEEP,
            "stencil_pass_depth_fail":gl.KEEP,
            "stencil_back_pass_depth_pass":gl.DECR_WRAP,
            "stencil_front_pass_depth_pass":gl.INCR_WRAP,
        });
    } else { //zfail
        setDrawStates(gl,false,{
            "stencil_fail":gl.KEEP,
            "stencil_back_pass_depth_fail":gl.INCR_WRAP,
            "stencil_front_pass_depth_fail":gl.DECR_WRAP,
            "stencil_pass_depth_pass":gl.KEEP,
        });
    }

    if(mymenu.shadowFace=='back') {
        setDrawStates(gl,false,{
            "depth_func":gl.LEQUAL
        });
    } else {
        setDrawStates(gl,false,{
            "polygon_offset_fill":true,
            "polygon_offset_factor":0,
            "polygon_offset_units":100
        });
    }
}

function shadowDebugStates() {
    setDrawStates(gl,true,{
        "depth_test":true,
        "depth_writemask":false,
        "depth_func":gl.LEQUAL,
    });

    // if(mymenu.shadowFace=='back') {
    setDrawStates(gl,false,{
        "depth_func":gl.LEQUAL,
    });
    // } else {
    // setDrawStates(gl,false,{
    // "polygon_offset_fill":true,
    // "polygon_offset_factor":0,
    // "polygon_offset_units":100
    // });
    // }

}

function lightStates() {
    setDrawStates(gl,true,{
        "cull_face":true,
        "depth_test":true,
        "stencil_test":true,
        "stencil_fail":gl.KEEP,
        "stencil_pass_depth_fail":gl.KEEP,
        "stencil_pass_depth_pass":gl.KEEP,
        "stencil_func":gl.EQUAL, //gl.NOTEQUAL,
        "stencil_ref":0x0,
        "stencil_valuemask":0xff,

        // "stencil_writemask":0xff,
    });
}

function ambientStates() {
    setDrawStates(gl,true,{
        "cull_face":true,
        "depth_test":true,
        "stencil_test":true,
        "stencil_pass_depth_fail":gl.KEEP,
        "stencil_pass_depth_pass":gl.KEEP,
        "stencil_fail":gl.KEEP,
        "stencil_func":gl.NOTEQUAL,
        "stencil_ref":0x0,
        "stencil_valuemask":0xff,
    });
}

function billboardStates() {
    setDrawStates(gl,true,{
        "cull_face":true,
        "depth_test":true,
        "blend":true,
        "blend_src":gl.SRC_ALPHA,
        "blend_dst":gl.ONE_MINUS_SRC_ALPHA, //gl.ONE
    });
}

function drawObjectDepth(obj,mesh) {
    if(!mesh || !simpleProg) {
        return;
    }

    //
    gl.useProgram(simpleProg);

    gl.bindVertexArray(mesh.vao);



    //    
  
    uniformMatrix4fv(gl,"u_modelMat",false,obj.modelMat);

    uniformsApply(gl,simpleProg);

    //draw
    gl.drawElements(gl.TRIANGLES, mesh.indsNum, gl.UNSIGNED_INT, 0);

}

function drawObjectLit(obj,mesh,mtrl) {
    if(!mesh) {
        return;
    }

    //
    var prog;

    if(lightcProg && mtrl && mtrl.colTex!=undefined) {
        prog=lightcProg;
    } else if(lightProg){
        prog=lightProg;
    } else {
        return;
    }

    gl.useProgram(prog);

    //
    if(mtrl && mtrl.colTex!=undefined) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mtrl.colTex);
    }

    //

    gl.bindVertexArray(mesh.vao);

    //

    var col=(mtrl&&mtrl.color)?mtrl.color:[1,1,1];
    var shininess=(mtrl&&mtrl.shininess)?mtrl.shininess:0.5;

    //
    uniformMatrix4fv(gl,"u_modelMat",false,obj.modelMat);
    uniformMatrix4fv(gl,"u_modelViewMat",false,obj.modelViewMat);
    uniformMatrix3fv(gl,"u_normalMat",false,obj.normalMat);
    uniform1f(gl,"u_shininess",shininess);

    uniform3fv(gl,"u_materialCol",col);

    //
    uniformsApply(gl,prog);

    //
    gl.drawElements(gl.TRIANGLES, mesh.indsNum, gl.UNSIGNED_INT, 0);


    gl.bindVertexArray(null);
}

function drawObjectAmbient(obj,mesh,mtrl) {
    if(!mesh) {
        return;
    }

    //
    var prog;

    if(ambientcProg && mtrl && mtrl.colTex!=undefined) {
        prog=ambientcProg;
    }else if(ambientProg) {
        prog=ambientProg;
    } else {
        return;
    }



    gl.useProgram(prog);

    //
    if(mtrl&&mtrl.colTex!=undefined) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mtrl.colTex);
    }

    //

    gl.bindVertexArray(mesh.vao);


    var col=(mtrl&&mtrl.color)?mtrl.color:[1,1,1];
    //
    uniformMatrix4fv(gl,"u_modelMat",false,obj.modelMat);
    uniform3fv(gl,"u_materialCol",col);

    //
    uniformsApply(gl,prog);

    //
    gl.drawElements(gl.TRIANGLES, mesh.indsNum, gl.UNSIGNED_INT, 0);


    gl.bindVertexArray(null);

}



function drawBillboard(obj) {
    if(!billboardProg) {
        return;
    }

    uniformMatrix4fv(gl,"u_modelViewProjMat",false,obj.modelViewProjMat);
    uniformMatrix4fv(gl,"u_modelViewMat",false,obj.modelViewMat);

    gl.useProgram(billboardProg);
    uniformsApply(gl,billboardProg);



    gl.bindVertexArray(billboardMesh.vao);


    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

}


function onRender(curTime) {
    //

    //projection
    var aspect=canvas.width/canvas.height;
    var zNear=1.0;
    var zFar=100.0;
    var fovy=Math.PI/4.0;

    mat4_perspective_fovy_inf(infProjMat,fovy,aspect,zNear);

    mat4_perspective_fovy(projMat,fovy,aspect,zNear,zFar);

    //
    scene.light.pos[0]=mymenu.lightX;
    scene.light.pos[1]=mymenu.lightY;
    scene.light.pos[2]=mymenu.lightZ;

    uniform1f(gl,"u_strength",0.25);

    //view
    viewMat=cameraControl.getView();

    //ground
    mat4.identity(scene.ground.modelMat);
    mat4.translate(scene.ground.modelMat,scene.ground.modelMat,vec3.fromValues(0,mymenu.groundY,0));
    mat4.scale(scene.ground.modelMat,scene.ground.modelMat,vec3.fromValues(mymenu.groundScale,mymenu.groundScale,mymenu.groundScale));

    mat4.scale(scene.ground.modelMat,scene.ground.modelMat,vec3.fromValues(8,1,8));


    //teapot
    mat4.identity(scene.teapot.modelMat);
    mat4.translate(scene.teapot.modelMat,scene.teapot.modelMat, vec3.fromValues(0,2,0));
    mat4.scale(scene.teapot.modelMat,scene.teapot.modelMat, vec3.fromValues(1,1,1));

mat4.multiply(scene.teapot.modelMat,scene.teapot.modelMat,blaMat);
    if(mymenu.sceneAnimate) {
        //~ mat4.rotateY(scene.teapot.modelMat,scene.teapot.modelMat,curTime);
    }
    //mat4.translate(scene.teapot.modelMat,scene.teapot.modelMat, vec3.fromValues(0.5,0,0.5));

    //light
    vec4.transformMat4(scene.light.viewPos,scene.light.pos,viewMat);
    uniform4fv(gl,"u_lightViewPos",scene.light.viewPos);
    uniform3fv(gl,"u_lightPos",scene.light.pos.slice(0,3));

    mat4.identity(scene.light.modelMat);
    mat4.translate(scene.light.modelMat,scene.light.modelMat,scene.light.pos);

    //
    calcObjTransform(scene.teapot,projMat,infProjMat,viewMat);
    calcObjTransform(scene.ground,projMat,infProjMat,viewMat);
    calcObjTransform(scene.light,projMat,infProjMat,viewMat);
    
    mat4.multiply(viewProjMat,projMat,viewMat);
    mat4.multiply(viewInfProjMat,infProjMat,viewMat);
    

    //
        uniformMatrix4fv(gl,"u_projMat",false,infProjMat);
        uniformMatrix4fv(gl,"u_viewProjMat",false,viewInfProjMat);



    uniform1i(gl,"u_useBack",(mymenu.shadowFace=='back')?1:0);
    

    //

    setDrawStates(gl,false,{
        "depth_test":true,
        "color_writemask":[true,true,true,true],
        "depth_writemask":true,
    });

    gl.clearColor(0,0,0,1);
    gl.clearStencil(0);
    //gl.clearColor(0.1,0.1,0.1,1);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);

    //render depths
    depthStates();

    if(mymenu.groundVisible){
        drawObjectDepth(scene.ground,groundMesh);
    }

    drawObjectDepth(scene.teapot,teapotMesh);

    //render shadow volume stencils
    if(!mymenu.disableShadows) {
        shadowStates();
        drawShadow(scene.teapot,teapotShdMesh);
    }
    //

    setDrawStates(gl,false,{
        "depth_test":true,
        "depth_writemask":true
    });

    gl.clear(gl.DEPTH_BUFFER_BIT);

    //render lit objects
    lightStates();

    if(mymenu.groundVisible){
        drawObjectLit(scene.ground,groundMesh,groundMtrl);
    }

    drawObjectLit(scene.teapot,teapotMesh,teapotMtrl);


    //render ambients
    ambientStates();

    if(mymenu.groundVisible){
        drawObjectAmbient(scene.ground,groundMesh,groundMtrl);
    }
    drawObjectAmbient(scene.teapot,teapotMesh,teapotMtrl);

    //render debug shadow volumes
    shadowDebugStates();

    if(mymenu.shadowDebugVolume) {
        setDrawStates(gl,false,{
            "blend":true,
            "blend_src":gl.SRC_ALPHA,
            "blend_dst":gl.ONE_MINUS_SRC_ALPHA,
        });

        drawShadow(scene.teapot,teapotShdMesh);
    }

    if(mymenu.shadowDebugWireframe) {
        setDrawStates(gl,false,{
            "blend":false,
            "blend_src":gl.ONE,
            "blend_dst":gl.DST_ALPHA,
        });

        drawShadowWireframe(scene.teapot,teapotShdMesh);
    }


    //draw light billboard
    billboardStates();
    drawBillboard(scene.light);



    updateBarFps(calcFPS());
    updateBarTime(curTime);

}

function log(msg) {
    var textarea = document.getElementById("log");
    textarea.innerHTML += String(msg).replace(/\n/g,"<br />") + "<br />";
}

//~ var getTime=(function(){
    //~ var start;
    //~ return (()=>{
        //~ start=start||Date.now();
        //~ return ((Date.now()-start)/1000)%3.402823e+38;
    //~ });
//~ })();


var getTime=(function(){var start;return (()=>{start=start||Date.now(); return ((Date.now()-start)/1000)%3.402823e+38;});})();

var calcFPS=createFpsCounter();

var fixedTimeStep=createFixedTimeStep(1/30,5);

function onAnimate() {

    //
    var resScale=1.0;
    var width=Math.floor(canvas.offsetWidth*resScale);
    var height=Math.floor(canvas.offsetHeight*resScale);

    var aspect=width/height;
    var fovy=Math.PI/4;

    cameraControl.update();

    //canvas.width=width;
    //canvas.height=height;

    var curTime=getTime();

    //
    fixedTimeStep(curTime,(dt)=>{
        cameraControl.step(dt);

    },(dt,it)=>{
        cameraControl.render(dt,it);
    });
    onRender(curTime) ;

    requestAnimFrame(onAnimate);
}



function registerInputEvents(element) {
    (function(){
        var lmb=false;
        

        window.addEventListener("keydown", (function(event){
            cameraControl.keydown(event);
            //event.preventDefault();
        }),true);

        document.addEventListener("keyup", (function(event){
            cameraControl.keyup(event);
            // event.preventDefault();
        }),true);

        element.addEventListener('mousemove', function(event) {
            if(PL.isEnabled() || (!PL.isSupported && lmb)) {
                if(!event.ctrlKey) {
                    cameraControl.mousemove(event);
                } else {
                                    
                    //var aaa=mat4.clone(viewMat);
                    ////mat4.copy(aaa,viewMat);
                    //aaa[12]=aaa[13]=aaa[14]=0.0;
                    //mat4.transpose(aaa,aaa);
                    //mat4.rotateY(aaa,aaa,event.movementX*0.01);
                    //mat4.rotateX(aaa,aaa,event.movementY*0.01);
                    
                    var aaa=mat4.create();
                    mat4.identity(aaa);
                    mat4.rotate(aaa, aaa, event.movementY*0.01, [viewMat[0],viewMat[4],viewMat[8]])  ;
                    mat4.rotate(aaa, aaa, event.movementX*0.01, [viewMat[1],viewMat[5],viewMat[9]])  ;    
                    
                    mat4.multiply(blaMat,aaa,blaMat);
                    
                }
            }
            

        }, false);

        element.addEventListener("mousedown",function(event){
            if(event.button==0){
                lmb=true;
                if(PL.isEnabled()) {
                    PL.exitPointerLock();
                } else {
                    PL.requestPointerLock(element);
                }
            }
        });

        window.addEventListener("mouseup",function(event){
            if(event.button==0&&lmb){
                lmb=false;
                  PL.exitPointerLock();
            }
        });
    })();
}

function init() {
    canvas=document.getElementById("canvas");
    gl=glutil.createContext(canvas,{stencil: true,antialias: true});

    if(!gl) {
        return;
    }

    canvas.onselectstart=null;

    registerInputEvents(canvas);

    onInit2();
    initMenu();

    onAnimate();
}

function doShadowMesh(verts,inds) {

    var cleanedGeometry=cleanVertsInds(verts,inds)
    var capVerts=generateCapVerts(cleanedGeometry.vertices,cleanedGeometry.indices);
    var capVao=createGeometry([0,3,capVerts[0]],[1,3,capVerts[1]],[2,3,capVerts[2]],null);
    var capLinesVao=createGeometry([0,3,capVerts[0]],[1,3,capVerts[1]],[2,3,capVerts[2]],capVerts[4]);

    var result3=generateSideVertsInds(cleanedGeometry.vertices,cleanedGeometry.indices);
    var sideVao=createGeometry([0,3,result3[0]],[1,3,result3[1]],[2,3,result3[2]],[3,3,result3[3]],result3[4]);

    var sideLinesVao=createGeometry([0,3,result3[0]],[1,3,result3[1]],[2,3,result3[2]],[3,3,result3[3]],result3[5]);


    return {
            "capVao":capVao,"capVertsNum":capVerts[0].length/3,
            "capLinesVao":capLinesVao,"capLinesIndsNum":capVerts[4].length,
            "sideVao":sideVao,"sideIndsNum":result3[4].length,
            "sideLinesVao":sideLinesVao,"sideLinesIndsNum":result3[5].length,
           };
}


function drawShadowCapsAltWireframe(obj,mesh) {
    if(!mesh || !shadowFrontProg || !shadowBackProg) {
        return;
    }

    //
    gl.bindVertexArray(mesh.capLinesVao);


    setDrawStates(gl,false,{
        "front_face":gl.CW
    });

    gl.useProgram(shadowBackProg);
    uniformsApply(gl,shadowBackProg);
    gl.drawElements(gl.LINES, mesh.capLinesIndsNum, gl.UNSIGNED_INT, 0);

    setDrawStates(gl,false,{
        "front_face":gl.CCW
    });

    gl.useProgram(shadowFrontProg);
    uniformsApply(gl,shadowFrontProg);

    gl.drawElements(gl.LINES, mesh.capLinesIndsNum, gl.UNSIGNED_INT, 0);

}

function drawShadowSidesAltWireframe(obj,mesh) {
    if(!mesh || !shadowSideProg) {
        return;
    }

    //
    gl.bindVertexArray(mesh.sideLinesVao);
    gl.useProgram(shadowSideProg);
    uniformsApply(gl,shadowSideProg);


        gl.drawElements(gl.LINES, mesh.sideLinesIndsNum, gl.UNSIGNED_INT, 0);

}


function drawShadowCapsAlt(obj,mesh) {
    if(!mesh || !shadowFrontProg || !shadowBackProg) {
        return;
    }

    //
    gl.bindVertexArray(mesh.capVao);


    setDrawStates(gl,false,{
        "front_face":gl.CW
    });

    gl.useProgram(shadowBackProg);
    uniformsApply(gl,shadowBackProg);
    gl.drawArrays(gl.TRIANGLES,0,mesh.capVertsNum);

    setDrawStates(gl,false,{
        "front_face":gl.CCW
    });

    gl.useProgram(shadowFrontProg);
    uniformsApply(gl,shadowFrontProg);
    gl.drawArrays(gl.TRIANGLES,0,mesh.capVertsNum);

}

function drawShadowSidesAlt(obj,mesh) {
    if(!mesh || !shadowSideProg) {
        return;
    }

    //

    gl.bindVertexArray(mesh.sideVao);
    gl.useProgram(shadowSideProg);
    uniformsApply(gl,shadowSideProg);
    gl.drawElements(gl.TRIANGLES, mesh.sideIndsNum, gl.UNSIGNED_INT, 0);
}

function drawShadow(obj,mesh) {
    if( !mesh || !shadowFrontProg || !shadowBackProg || !shadowSideProg) {
        return;
    }

    uniformMatrix4fv(gl,"u_modelViewMat",false,obj.modelViewMat);
    uniformMatrix4fv(gl,"u_invModelMat",false,obj.invModelMat);
    uniformMatrix4fv(gl,"u_modelMat",false,obj.modelMat);
    
    uniform4f(gl,"u_col",1,1,1,0.1);

    if(mymenu.shadowZ=='fail') {

            drawShadowCapsAlt(obj,mesh);

    }

        drawShadowSidesAlt(obj,mesh);



    gl.bindVertexArray(null);

}

function drawShadowWireframe(obj,mesh) {
    if( !mesh || !shadowFrontProg || !shadowBackProg || !shadowSideProg) {
        return;
    }

    uniformMatrix4fv(gl,"u_modelViewMat",false,obj.modelViewMat);
    uniformMatrix4fv(gl,"u_invModelMat",false,obj.invModelMat);
    uniformMatrix4fv(gl,"u_modelMat",false,obj.modelMat);

    //


    if(mymenu.shadowZ=='fail') {
        uniform4f(gl,"u_col",1,1,0,1);

            drawShadowCapsAltWireframe(obj,mesh) ;


    }
    
    
        uniform4f(gl,"u_col",0,1,1,1);

        drawShadowSidesAltWireframe(obj,mesh);

    gl.bindVertexArray(null);

}


window.onload=init;

window.onresize=(function(){window.scrollTo(0,0);});

window.requestAnimFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    (function(c,e){window.setTimeout(c,1000/60)});

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;
