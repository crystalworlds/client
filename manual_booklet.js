/* ---- StPageFlip (page-flip) v2, bundled inline for offline use ----
 * https://github.com/Nodlik/StPageFlip
 *
 * MIT License
 *
 * Copyright (c) 2020 Nodlik
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * RESOLVED 2026-10-28: copyright line and permission notice added here as the
 * licence requires; also licenses/THIRD-PARTY-NOTICES section 10.
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((t=t||self).St={})}(this,(function(t){"use strict";class e{constructor(t,e){this.state={angle:0,area:[],position:{x:0,y:0},hardAngle:0,hardDrawingAngle:0},this.createdDensity=e,this.nowDrawingDensity=this.createdDensity,this.render=t}setDensity(t){this.createdDensity=t,this.nowDrawingDensity=t}setDrawingDensity(t){this.nowDrawingDensity=t}setPosition(t){this.state.position=t}setAngle(t){this.state.angle=t}setArea(t){this.state.area=t}setHardDrawingAngle(t){this.state.hardDrawingAngle=t}setHardAngle(t){this.state.hardAngle=t,this.state.hardDrawingAngle=t}setOrientation(t){this.orientation=t}getDrawingDensity(){return this.nowDrawingDensity}getDensity(){return this.createdDensity}getHardAngle(){return this.state.hardAngle}}class i extends e{constructor(t,e,i){super(t,i),this.image=null,this.isLoad=!1,this.loadingAngle=0,this.image=new Image,this.image.src=e}draw(t){const e=this.render.getContext(),i=this.render.convertToGlobal(this.state.position),s=this.render.getRect().pageWidth,n=this.render.getRect().height;e.save(),e.translate(i.x,i.y),e.beginPath();for(let t of this.state.area)null!==t&&(t=this.render.convertToGlobal(t),e.lineTo(t.x-i.x,t.y-i.y));e.rotate(this.state.angle),e.clip(),this.isLoad?e.drawImage(this.image,0,0,s,n):this.drawLoader(e,{x:0,y:0},s,n),e.restore()}simpleDraw(t){const e=this.render.getRect(),i=this.render.getContext(),s=e.pageWidth,n=e.height,h=1===t?e.left+e.pageWidth:e.left,r=e.top;this.isLoad?i.drawImage(this.image,h,r,s,n):this.drawLoader(i,{x:h,y:r},s,n)}drawLoader(t,e,i,s){t.beginPath(),t.strokeStyle="rgb(200, 200, 200)",t.fillStyle="rgb(255, 255, 255)",t.lineWidth=1,t.rect(e.x+1,e.y+1,i-1,s-1),t.stroke(),t.fill();const n={x:e.x+i/2,y:e.y+s/2};t.beginPath(),t.lineWidth=10,t.arc(n.x,n.y,20,this.loadingAngle,3*Math.PI/2+this.loadingAngle),t.stroke(),t.closePath(),this.loadingAngle+=.07,this.loadingAngle>=2*Math.PI&&(this.loadingAngle=0)}load(){this.isLoad||(this.image.onload=()=>{this.isLoad=!0})}newTemporaryCopy(){return this}getTemporaryCopy(){return this}hideTemporaryCopy(){}}class s{constructor(t,e){this.pages=[],this.currentPageIndex=0,this.currentSpreadIndex=0,this.landscapeSpread=[],this.portraitSpread=[],this.render=e,this.app=t,this.currentPageIndex=0,this.isShowCover=this.app.getSettings().showCover}destroy(){this.pages=[]}createSpread(){this.landscapeSpread=[],this.portraitSpread=[];for(let t=0;t<this.pages.length;t++)this.portraitSpread.push([t]);let t=0;this.isShowCover&&(this.pages[0].setDensity("hard"),this.landscapeSpread.push([t]),t++);for(let e=t;e<this.pages.length;e+=2)e<this.pages.length-1?this.landscapeSpread.push([e,e+1]):(this.landscapeSpread.push([e]),this.pages[e].setDensity("hard"))}getSpread(){return"landscape"===this.render.getOrientation()?this.landscapeSpread:this.portraitSpread}getSpreadIndexByPage(t){const e=this.getSpread();for(let i=0;i<e.length;i++)if(t===e[i][0]||t===e[i][1])return i;return null}getPageCount(){return this.pages.length}getPages(){return this.pages}getPage(t){if(t>=0&&t<this.pages.length)return this.pages[t];throw new Error("Invalid page number")}nextBy(t){const e=this.pages.indexOf(t);return e<this.pages.length-1?this.pages[e+1]:null}prevBy(t){const e=this.pages.indexOf(t);return e>0?this.pages[e-1]:null}getFlippingPage(t){const e=this.currentSpreadIndex;if("portrait"===this.render.getOrientation())return 0===t?this.pages[e].newTemporaryCopy():this.pages[e-1];{const i=0===t?this.getSpread()[e+1]:this.getSpread()[e-1];return 1===i.length||0===t?this.pages[i[0]]:this.pages[i[1]]}}getBottomPage(t){const e=this.currentSpreadIndex;if("portrait"===this.render.getOrientation())return 0===t?this.pages[e+1]:this.pages[e-1];{const i=0===t?this.getSpread()[e+1]:this.getSpread()[e-1];return 1===i.length?this.pages[i[0]]:0===t?this.pages[i[1]]:this.pages[i[0]]}}showNext(){this.currentSpreadIndex<this.getSpread().length&&(this.currentSpreadIndex++,this.showSpread())}showPrev(){this.currentSpreadIndex>0&&(this.currentSpreadIndex--,this.showSpread())}getCurrentPageIndex(){return this.currentPageIndex}show(t=null){if(null===t&&(t=this.currentPageIndex),t<0||t>=this.pages.length)return;const e=this.getSpreadIndexByPage(t);null!==e&&(this.currentSpreadIndex=e,this.showSpread())}getCurrentSpreadIndex(){return this.currentSpreadIndex}setCurrentSpreadIndex(t){if(!(t>=0&&t<this.getSpread().length))throw new Error("Invalid page");this.currentSpreadIndex=t}showSpread(){const t=this.getSpread()[this.currentSpreadIndex];2===t.length?(this.render.setLeftPage(this.pages[t[0]]),this.render.setRightPage(this.pages[t[1]])):"landscape"===this.render.getOrientation()&&t[0]===this.pages.length-1?(this.render.setLeftPage(this.pages[t[0]]),this.render.setRightPage(null)):(this.render.setLeftPage(null),this.render.setRightPage(this.pages[t[0]])),this.currentPageIndex=t[0],this.app.updatePageIndex(this.currentPageIndex)}}class n extends s{constructor(t,e,i){super(t,e),this.imagesHref=i}load(){for(const t of this.imagesHref){const e=new i(this.render,t,"soft");e.load(),this.pages.push(e)}this.createSpread()}}class h{static GetDistanceBetweenTwoPoint(t,e){return null===t||null===e?1/0:Math.sqrt(Math.pow(e.x-t.x,2)+Math.pow(e.y-t.y,2))}static GetSegmentLength(t){return h.GetDistanceBetweenTwoPoint(t[0],t[1])}static GetAngleBetweenTwoLine(t,e){const i=t[0].y-t[1].y,s=e[0].y-e[1].y,n=t[1].x-t[0].x,h=e[1].x-e[0].x;return Math.acos((i*s+n*h)/(Math.sqrt(i*i+n*n)*Math.sqrt(s*s+h*h)))}static PointInRect(t,e){return null===e?null:e.x>=t.left&&e.x<=t.width+t.left&&e.y>=t.top&&e.y<=t.top+t.height?e:null}static GetRotatedPoint(t,e,i){return{x:t.x*Math.cos(i)+t.y*Math.sin(i)+e.x,y:t.y*Math.cos(i)-t.x*Math.sin(i)+e.y}}static LimitPointToCircle(t,e,i){if(h.GetDistanceBetweenTwoPoint(t,i)<=e)return i;const s=t.x,n=t.y,r=i.x,o=i.y;let a=Math.sqrt(Math.pow(e,2)*Math.pow(s-r,2)/(Math.pow(s-r,2)+Math.pow(n-o,2)))+s;i.x<0&&(a*=-1);let g=(a-s)*(n-o)/(s-r)+n;return s-r+n===0&&(g=e),{x:a,y:g}}static GetIntersectBetweenTwoSegment(t,e,i){return h.PointInRect(t,h.GetIntersectBeetwenTwoLine(e,i))}static GetIntersectBeetwenTwoLine(t,e){const i=t[0].y-t[1].y,s=e[0].y-e[1].y,n=t[1].x-t[0].x,h=e[1].x-e[0].x,r=t[0].x*t[1].y-t[1].x*t[0].y,o=e[0].x*e[1].y-e[1].x*e[0].y,a=i*o-s*r,g=n*o-h*r,l=-(r*h-o*n)/(i*h-s*n),d=-(i*o-s*r)/(i*h-s*n);if(isFinite(l)&&isFinite(d))return{x:l,y:d};if(Math.abs(a-g)<.1)throw new Error("Segment included");return null}static GetCordsFromTwoPoint(t,e){const i=Math.abs(t.x-e.x),s=Math.abs(t.y-e.y),n=Math.max(i,s),h=[t];function r(t,e,i,s,n){return e>t?t+n*(i/s):e<t?t-n*(i/s):t}for(let o=1;o<=n;o+=1)h.push({x:r(t.x,e.x,i,n,o),y:r(t.y,e.y,s,n,o)});return h}}class r extends e{constructor(t,e,i){super(t,i),this.copiedElement=null,this.temporaryCopy=null,this.isLoad=!1,this.element=e,this.element.classList.add("stf__item"),this.element.classList.add("--"+i)}newTemporaryCopy(){return"hard"===this.nowDrawingDensity?this:(null===this.temporaryCopy&&(this.copiedElement=this.element.cloneNode(!0),this.element.parentElement.appendChild(this.copiedElement),this.temporaryCopy=new r(this.render,this.copiedElement,this.nowDrawingDensity)),this.getTemporaryCopy())}getTemporaryCopy(){return this.temporaryCopy}hideTemporaryCopy(){null!==this.temporaryCopy&&(this.copiedElement.remove(),this.copiedElement=null,this.temporaryCopy=null)}draw(t){const e=t||this.nowDrawingDensity,i=this.render.convertToGlobal(this.state.position),s=this.render.getRect().pageWidth,n=this.render.getRect().height;this.element.classList.remove("--simple");const h=`\n            display: block;\n            z-index: ${this.element.style.zIndex};\n            left: 0;\n            top: 0;\n            width: ${s}px;\n            height: ${n}px;\n        `;"hard"===e?this.drawHard(h):this.drawSoft(i,h)}drawHard(t=""){const e=this.render.getRect().left+this.render.getRect().width/2,i=this.state.hardDrawingAngle,s=t+"\n                backface-visibility: hidden;\n                -webkit-backface-visibility: hidden;\n                clip-path: none;\n                -webkit-clip-path: none;\n            "+(0===this.orientation?`transform-origin: ${this.render.getRect().pageWidth}px 0; \n                   transform: translate3d(0, 0, 0) rotateY(${i}deg);`:`transform-origin: 0 0; \n                   transform: translate3d(${e}px, 0, 0) rotateY(${i}deg);`);this.element.style.cssText=s}drawSoft(t,e=""){let i="polygon( ";for(const t of this.state.area)if(null!==t){let e=1===this.render.getDirection()?{x:-t.x+this.state.position.x,y:t.y-this.state.position.y}:{x:t.x-this.state.position.x,y:t.y-this.state.position.y};e=h.GetRotatedPoint(e,{x:0,y:0},this.state.angle),i+=e.x+"px "+e.y+"px, "}i=i.slice(0,-2),i+=")";const s=e+`transform-origin: 0 0; clip-path: ${i}; -webkit-clip-path: ${i};`+(this.render.isSafari()&&0===this.state.angle?`transform: translate(${t.x}px, ${t.y}px);`:`transform: translate3d(${t.x}px, ${t.y}px, 0) rotate(${this.state.angle}rad);`);this.element.style.cssText=s}simpleDraw(t){const e=this.render.getRect(),i=e.pageWidth,s=e.height,n=1===t?e.left+e.pageWidth:e.left,h=e.top;this.element.classList.add("--simple"),this.element.style.cssText=`\n            position: absolute; \n            display: block; \n            height: ${s}px; \n            left: ${n}px; \n            top: ${h}px; \n            width: ${i}px; \n            z-index: ${this.render.getSettings().startZIndex+1};`}getElement(){return this.element}load(){this.isLoad=!0}setOrientation(t){super.setOrientation(t),this.element.classList.remove("--left","--right"),this.element.classList.add(1===t?"--right":"--left")}setDrawingDensity(t){this.element.classList.remove("--soft","--hard"),this.element.classList.add("--"+t),super.setDrawingDensity(t)}}class o extends s{constructor(t,e,i,s){super(t,e),this.element=i,this.pagesElement=s}load(){for(const t of this.pagesElement){const e=new r(this.render,t,"hard"===t.dataset.density?"hard":"soft");e.load(),this.pages.push(e)}this.createSpread()}}class a{constructor(t,e,i,s){this.direction=t,this.corner=e,this.topIntersectPoint=null,this.sideIntersectPoint=null,this.bottomIntersectPoint=null,this.pageWidth=parseInt(i,10),this.pageHeight=parseInt(s,10)}calc(t){try{return this.position=this.calcAngleAndPosition(t),this.calculateIntersectPoint(this.position),!0}catch(t){return!1}}getFlippingClipArea(){const t=[];let e=!1;return t.push(this.rect.topLeft),t.push(this.topIntersectPoint),null===this.sideIntersectPoint?e=!0:(t.push(this.sideIntersectPoint),null===this.bottomIntersectPoint&&(e=!1)),t.push(this.bottomIntersectPoint),(e||"bottom"===this.corner)&&t.push(this.rect.bottomLeft),t}getBottomClipArea(){const t=[];return t.push(this.topIntersectPoint),"top"===this.corner?t.push({x:this.pageWidth,y:0}):(null!==this.topIntersectPoint&&t.push({x:this.pageWidth,y:0}),t.push({x:this.pageWidth,y:this.pageHeight})),null!==this.sideIntersectPoint?h.GetDistanceBetweenTwoPoint(this.sideIntersectPoint,this.topIntersectPoint)>=10&&t.push(this.sideIntersectPoint):"top"===this.corner&&t.push({x:this.pageWidth,y:this.pageHeight}),t.push(this.bottomIntersectPoint),t.push(this.topIntersectPoint),t}getAngle(){return 0===this.direction?-this.angle:this.angle}getRect(){return this.rect}getPosition(){return this.position}getActiveCorner(){return 0===this.direction?this.rect.topLeft:this.rect.topRight}getDirection(){return this.direction}getFlippingProgress(){return Math.abs((this.position.x-this.pageWidth)/(2*this.pageWidth)*100)}getCorner(){return this.corner}getBottomPagePosition(){return 1===this.direction?{x:this.pageWidth,y:0}:{x:0,y:0}}getShadowStartPoint(){return"top"===this.corner?this.topIntersectPoint:null!==this.sideIntersectPoint?this.sideIntersectPoint:this.topIntersectPoint}getShadowAngle(){const t=h.GetAngleBetweenTwoLine(this.getSegmentToShadowLine(),[{x:0,y:0},{x:this.pageWidth,y:0}]);return 0===this.direction?t:Math.PI-t}calcAngleAndPosition(t){let e=t;if(this.updateAngleAndGeometry(e),e="top"===this.corner?this.checkPositionAtCenterLine(e,{x:0,y:0},{x:0,y:this.pageHeight}):this.checkPositionAtCenterLine(e,{x:0,y:this.pageHeight},{x:0,y:0}),Math.abs(e.x-this.pageWidth)<1&&Math.abs(e.y)<1)throw new Error("Point is too small");return e}updateAngleAndGeometry(t){this.angle=this.calculateAngle(t),this.rect=this.getPageRect(t)}calculateAngle(t){const e=this.pageWidth-t.x+1,i="bottom"===this.corner?this.pageHeight-t.y:t.y;let s=2*Math.acos(e/Math.sqrt(i*i+e*e));i<0&&(s=-s);const n=Math.PI-s;if(!isFinite(s)||n>=0&&n<.003)throw new Error("The G point is too small");return"bottom"===this.corner&&(s=-s),s}getPageRect(t){return"top"===this.corner?this.getRectFromBasePoint([{x:0,y:0},{x:this.pageWidth,y:0},{x:0,y:this.pageHeight},{x:this.pageWidth,y:this.pageHeight}],t):this.getRectFromBasePoint([{x:0,y:-this.pageHeight},{x:this.pageWidth,y:-this.pageHeight},{x:0,y:0},{x:this.pageWidth,y:0}],t)}getRectFromBasePoint(t,e){return{topLeft:this.getRotatedPoint(t[0],e),topRight:this.getRotatedPoint(t[1],e),bottomLeft:this.getRotatedPoint(t[2],e),bottomRight:this.getRotatedPoint(t[3],e)}}getRotatedPoint(t,e){return{x:t.x*Math.cos(this.angle)+t.y*Math.sin(this.angle)+e.x,y:t.y*Math.cos(this.angle)-t.x*Math.sin(this.angle)+e.y}}calculateIntersectPoint(t){const e={left:-1,top:-1,width:this.pageWidth+2,height:this.pageHeight+2};"top"===this.corner?(this.topIntersectPoint=h.GetIntersectBetweenTwoSegment(e,[t,this.rect.topRight],[{x:0,y:0},{x:this.pageWidth,y:0}]),this.sideIntersectPoint=h.GetIntersectBetweenTwoSegment(e,[t,this.rect.bottomLeft],[{x:this.pageWidth,y:0},{x:this.pageWidth,y:this.pageHeight}]),this.bottomIntersectPoint=h.GetIntersectBetweenTwoSegment(e,[this.rect.bottomLeft,this.rect.bottomRight],[{x:0,y:this.pageHeight},{x:this.pageWidth,y:this.pageHeight}])):(this.topIntersectPoint=h.GetIntersectBetweenTwoSegment(e,[this.rect.topLeft,this.rect.topRight],[{x:0,y:0},{x:this.pageWidth,y:0}]),this.sideIntersectPoint=h.GetIntersectBetweenTwoSegment(e,[t,this.rect.topLeft],[{x:this.pageWidth,y:0},{x:this.pageWidth,y:this.pageHeight}]),this.bottomIntersectPoint=h.GetIntersectBetweenTwoSegment(e,[this.rect.bottomLeft,this.rect.bottomRight],[{x:0,y:this.pageHeight},{x:this.pageWidth,y:this.pageHeight}]))}checkPositionAtCenterLine(t,e,i){let s=t;const n=h.LimitPointToCircle(e,this.pageWidth,s);s!==n&&(s=n,this.updateAngleAndGeometry(s));const r=Math.sqrt(Math.pow(this.pageWidth,2)+Math.pow(this.pageHeight,2));let o=this.rect.bottomRight,a=this.rect.topLeft;if("bottom"===this.corner&&(o=this.rect.topRight,a=this.rect.bottomLeft),o.x<=0){const t=h.LimitPointToCircle(i,r,a);t!==s&&(s=t,this.updateAngleAndGeometry(s))}return s}getSegmentToShadowLine(){const t=this.getShadowStartPoint();return[t,t!==this.sideIntersectPoint&&null!==this.sideIntersectPoint?this.sideIntersectPoint:this.bottomIntersectPoint]}}class g{constructor(t,e){this.flippingPage=null,this.bottomPage=null,this.calc=null,this.state="read",this.render=t,this.app=e}fold(t){this.setState("user_fold"),null===this.calc&&this.start(t),this.do(this.render.convertToPage(t))}flip(t){if(this.app.getSettings().disableFlipByClick&&!this.isPointOnCorners(t))return;if(null!==this.calc&&this.render.finishAnimation(),!this.start(t))return;const e=this.getBoundsRect();this.setState("flipping");const i=e.height/10,s="bottom"===this.calc.getCorner()?e.height-i:i,n="bottom"===this.calc.getCorner()?e.height:0;this.calc.calc({x:e.pageWidth-i,y:s}),this.animateFlippingTo({x:e.pageWidth-i,y:s},{x:-e.pageWidth,y:n},!0)}start(t){this.reset();const e=this.render.convertToBook(t),i=this.getBoundsRect(),s=this.getDirectionByPoint(e),n=e.y>=i.height/2?"bottom":"top";if(!this.checkDirection(s))return!1;try{if(this.flippingPage=this.app.getPageCollection().getFlippingPage(s),this.bottomPage=this.app.getPageCollection().getBottomPage(s),"landscape"===this.render.getOrientation())if(1===s){const t=this.app.getPageCollection().nextBy(this.flippingPage);null!==t&&this.flippingPage.getDensity()!==t.getDensity()&&(this.flippingPage.setDrawingDensity("hard"),t.setDrawingDensity("hard"))}else{const t=this.app.getPageCollection().prevBy(this.flippingPage);null!==t&&this.flippingPage.getDensity()!==t.getDensity()&&(this.flippingPage.setDrawingDensity("hard"),t.setDrawingDensity("hard"))}return this.render.setDirection(s),this.calc=new a(s,n,i.pageWidth.toString(10),i.height.toString(10)),!0}catch(t){return!1}}do(t){if(null!==this.calc&&this.calc.calc(t)){const t=this.calc.getFlippingProgress();this.bottomPage.setArea(this.calc.getBottomClipArea()),this.bottomPage.setPosition(this.calc.getBottomPagePosition()),this.bottomPage.setAngle(0),this.bottomPage.setHardAngle(0),this.flippingPage.setArea(this.calc.getFlippingClipArea()),this.flippingPage.setPosition(this.calc.getActiveCorner()),this.flippingPage.setAngle(this.calc.getAngle()),0===this.calc.getDirection()?this.flippingPage.setHardAngle(90*(200-2*t)/100):this.flippingPage.setHardAngle(-90*(200-2*t)/100),this.render.setPageRect(this.calc.getRect()),this.render.setBottomPage(this.bottomPage),this.render.setFlippingPage(this.flippingPage),this.render.setShadowData(this.calc.getShadowStartPoint(),this.calc.getShadowAngle(),t,this.calc.getDirection())}}flipToPage(t,e){const i=this.app.getPageCollection().getCurrentSpreadIndex(),s=this.app.getPageCollection().getSpreadIndexByPage(t);try{s>i&&(this.app.getPageCollection().setCurrentSpreadIndex(s-1),this.flipNext(e)),s<i&&(this.app.getPageCollection().setCurrentSpreadIndex(s+1),this.flipPrev(e))}catch(t){}}flipNext(t){this.flip({x:this.render.getRect().left+2*this.render.getRect().pageWidth-10,y:"top"===t?1:this.render.getRect().height-2})}flipPrev(t){this.flip({x:10,y:"top"===t?1:this.render.getRect().height-2})}stopMove(){if(null===this.calc)return;const t=this.calc.getPosition(),e=this.getBoundsRect(),i="bottom"===this.calc.getCorner()?e.height:0;t.x<=0?this.animateFlippingTo(t,{x:-e.pageWidth,y:i},!0):this.animateFlippingTo(t,{x:e.pageWidth,y:i},!1)}showCorner(t){if(!this.checkState("read","fold_corner"))return;const e=this.getBoundsRect(),i=e.pageWidth;if(this.isPointOnCorners(t))if(null===this.calc){if(!this.start(t))return;this.setState("fold_corner"),this.calc.calc({x:i-1,y:1});const s=50,n="bottom"===this.calc.getCorner()?e.height-1:1,h="bottom"===this.calc.getCorner()?e.height-s:s;this.animateFlippingTo({x:i-1,y:n},{x:i-s,y:h},!1,!1)}else this.do(this.render.convertToPage(t));else this.setState("read"),this.render.finishAnimation(),this.stopMove()}animateFlippingTo(t,e,i,s=!0){const n=h.GetCordsFromTwoPoint(t,e),r=[];for(const t of n)r.push(()=>this.do(t));const o=this.getAnimationDuration(n.length);this.render.startAnimation(r,o,()=>{this.calc&&(i&&(1===this.calc.getDirection()?this.app.turnToPrevPage():this.app.turnToNextPage()),s&&(this.render.setBottomPage(null),this.render.setFlippingPage(null),this.render.clearShadow(),this.setState("read"),this.reset()))})}getCalculation(){return this.calc}getState(){return this.state}setState(t){this.state!==t&&(this.app.updateState(t),this.state=t)}getDirectionByPoint(t){const e=this.getBoundsRect();if("portrait"===this.render.getOrientation()){if(t.x-e.pageWidth<=e.width/5)return 1}else if(t.x<e.width/2)return 1;return 0}getAnimationDuration(t){const e=this.app.getSettings().flippingTime;return t>=1e3?e:t/1e3*e}checkDirection(t){return 0===t?this.app.getCurrentPageIndex()<this.app.getPageCount()-1:this.app.getCurrentPageIndex()>=1}reset(){this.calc=null,this.flippingPage=null,this.bottomPage=null}getBoundsRect(){return this.render.getRect()}checkState(...t){for(const e of t)if(this.state===e)return!0;return!1}isPointOnCorners(t){const e=this.getBoundsRect(),i=e.pageWidth,s=Math.sqrt(Math.pow(i,2)+Math.pow(e.height,2))/5,n=this.render.convertToBook(t);return n.x>0&&n.y>0&&n.x<e.width&&n.y<e.height&&(n.x<s||n.x>e.width-s)&&(n.y<s||n.y>e.height-s)}}class l{constructor(t,e){this.leftPage=null,this.rightPage=null,this.flippingPage=null,this.bottomPage=null,this.direction=null,this.orientation=null,this.shadow=null,this.animation=null,this.pageRect=null,this.boundsRect=null,this.timer=0,this.safari=!1,this.setting=e,this.app=t;const i=new RegExp("Version\\/[\\d\\.]+.*Safari/");this.safari=null!==i.exec(window.navigator.userAgent)}render(t){if(null!==this.animation){const e=Math.round((t-this.animation.startedAt)/this.animation.durationFrame);e<this.animation.frames.length?this.animation.frames[e]():(this.animation.onAnimateEnd(),this.animation=null)}this.timer=t,this.drawFrame()}start(){this.update();const t=e=>{this.render(e),requestAnimationFrame(t)};requestAnimationFrame(t)}startAnimation(t,e,i){this.finishAnimation(),this.animation={frames:t,duration:e,durationFrame:e/t.length,onAnimateEnd:i,startedAt:this.timer}}finishAnimation(){null!==this.animation&&(this.animation.frames[this.animation.frames.length-1](),null!==this.animation.onAnimateEnd&&this.animation.onAnimateEnd()),this.animation=null}update(){this.boundsRect=null;const t=this.calculateBoundsRect();this.orientation!==t&&(this.orientation=t,this.app.updateOrientation(t))}calculateBoundsRect(){let t="landscape";const e=this.getBlockWidth(),i=e/2,s=this.getBlockHeight()/2,n=this.setting.width/this.setting.height;let h=this.setting.width,r=this.setting.height,o=i-h;return"stretch"===this.setting.size?(e<2*this.setting.minWidth&&this.app.getSettings().usePortrait&&(t="portrait"),h="portrait"===t?this.getBlockWidth():this.getBlockWidth()/2,h>this.setting.maxWidth&&(h=this.setting.maxWidth),r=h/n,r>this.getBlockHeight()&&(r=this.getBlockHeight(),h=r*n),o="portrait"===t?i-h/2-h:i-h):e<2*h&&this.app.getSettings().usePortrait&&(t="portrait",o=i-h/2-h),this.boundsRect={left:o,top:s-r/2,width:2*h,height:r,pageWidth:h},t}setShadowData(t,e,i,s){if(!this.app.getSettings().drawShadow)return;const n=100*this.getSettings().maxShadowOpacity;this.shadow={pos:t,angle:e,width:3*this.getRect().pageWidth/4*i/100,opacity:(100-i)*n/100/100,direction:s,progress:2*i}}clearShadow(){this.shadow=null}getBlockWidth(){return this.app.getUI().getDistElement().offsetWidth}getBlockHeight(){return this.app.getUI().getDistElement().offsetHeight}getDirection(){return this.direction}getRect(){return null===this.boundsRect&&this.calculateBoundsRect(),this.boundsRect}getSettings(){return this.app.getSettings()}getOrientation(){return this.orientation}setPageRect(t){this.pageRect=t}setDirection(t){this.direction=t}setRightPage(t){null!==t&&t.setOrientation(1),this.rightPage=t}setLeftPage(t){null!==t&&t.setOrientation(0),this.leftPage=t}setBottomPage(t){null!==t&&t.setOrientation(1===this.direction?0:1),this.bottomPage=t}setFlippingPage(t){null!==t&&t.setOrientation(0===this.direction&&"portrait"!==this.orientation?0:1),this.flippingPage=t}convertToBook(t){const e=this.getRect();return{x:t.x-e.left,y:t.y-e.top}}isSafari(){return this.safari}convertToPage(t,e){e||(e=this.direction);const i=this.getRect();return{x:0===e?t.x-i.left-i.width/2:i.width/2-t.x+i.left,y:t.y-i.top}}convertToGlobal(t,e){if(e||(e=this.direction),null==t)return null;const i=this.getRect();return{x:0===e?t.x+i.left+i.width/2:i.width/2-t.x+i.left,y:t.y+i.top}}convertRectToGlobal(t,e){return e||(e=this.direction),{topLeft:this.convertToGlobal(t.topLeft,e),topRight:this.convertToGlobal(t.topRight,e),bottomLeft:this.convertToGlobal(t.bottomLeft,e),bottomRight:this.convertToGlobal(t.bottomRight,e)}}}class d extends l{constructor(t,e,i){super(t,e),this.canvas=i,this.ctx=i.getContext("2d")}getContext(){return this.ctx}reload(){}drawFrame(){this.clear(),"portrait"!==this.orientation&&null!=this.leftPage&&this.leftPage.simpleDraw(0),null!=this.rightPage&&this.rightPage.simpleDraw(1),null!=this.bottomPage&&this.bottomPage.draw(),this.drawBookShadow(),null!=this.flippingPage&&this.flippingPage.draw(),null!=this.shadow&&(this.drawOuterShadow(),this.drawInnerShadow());const t=this.getRect();"portrait"===this.orientation&&(this.ctx.beginPath(),this.ctx.rect(t.left+t.pageWidth,t.top,t.width,t.height),this.ctx.clip())}drawBookShadow(){const t=this.getRect();this.ctx.save(),this.ctx.beginPath();const e=t.width/20;this.ctx.rect(t.left,t.top,t.width,t.height);const i={x:t.left+t.width/2-e/2,y:0};this.ctx.translate(i.x,i.y);const s=this.ctx.createLinearGradient(0,0,e,0);s.addColorStop(0,"rgba(0, 0, 0, 0)"),s.addColorStop(.4,"rgba(0, 0, 0, 0.2)"),s.addColorStop(.49,"rgba(0, 0, 0, 0.1)"),s.addColorStop(.5,"rgba(0, 0, 0, 0.5)"),s.addColorStop(.51,"rgba(0, 0, 0, 0.4)"),s.addColorStop(1,"rgba(0, 0, 0, 0)"),this.ctx.clip(),this.ctx.fillStyle=s,this.ctx.fillRect(0,0,e,2*t.height),this.ctx.restore()}drawOuterShadow(){const t=this.getRect();this.ctx.save(),this.ctx.beginPath(),this.ctx.rect(t.left,t.top,t.width,t.height);const e=this.convertToGlobal({x:this.shadow.pos.x,y:this.shadow.pos.y});this.ctx.translate(e.x,e.y),this.ctx.rotate(Math.PI+this.shadow.angle+Math.PI/2);const i=this.ctx.createLinearGradient(0,0,this.shadow.width,0);0===this.shadow.direction?(this.ctx.translate(0,-100),i.addColorStop(0,"rgba(0, 0, 0, "+this.shadow.opacity+")"),i.addColorStop(1,"rgba(0, 0, 0, 0)")):(this.ctx.translate(-this.shadow.width,-100),i.addColorStop(0,"rgba(0, 0, 0, 0)"),i.addColorStop(1,"rgba(0, 0, 0, "+this.shadow.opacity+")")),this.ctx.clip(),this.ctx.fillStyle=i,this.ctx.fillRect(0,0,this.shadow.width,2*t.height),this.ctx.restore()}drawInnerShadow(){const t=this.getRect();this.ctx.save(),this.ctx.beginPath();const e=this.convertToGlobal({x:this.shadow.pos.x,y:this.shadow.pos.y}),i=this.convertRectToGlobal(this.pageRect);this.ctx.moveTo(i.topLeft.x,i.topLeft.y),this.ctx.lineTo(i.topRight.x,i.topRight.y),this.ctx.lineTo(i.bottomRight.x,i.bottomRight.y),this.ctx.lineTo(i.bottomLeft.x,i.bottomLeft.y),this.ctx.translate(e.x,e.y),this.ctx.rotate(Math.PI+this.shadow.angle+Math.PI/2);const s=3*this.shadow.width/4,n=this.ctx.createLinearGradient(0,0,s,0);0===this.shadow.direction?(this.ctx.translate(-s,-100),n.addColorStop(1,"rgba(0, 0, 0, "+this.shadow.opacity+")"),n.addColorStop(.9,"rgba(0, 0, 0, 0.05)"),n.addColorStop(.7,"rgba(0, 0, 0, "+this.shadow.opacity+")"),n.addColorStop(0,"rgba(0, 0, 0, 0)")):(this.ctx.translate(0,-100),n.addColorStop(0,"rgba(0, 0, 0, "+this.shadow.opacity+")"),n.addColorStop(.1,"rgba(0, 0, 0, 0.05)"),n.addColorStop(.3,"rgba(0, 0, 0, "+this.shadow.opacity+")"),n.addColorStop(1,"rgba(0, 0, 0, 0)")),this.ctx.clip(),this.ctx.fillStyle=n,this.ctx.fillRect(0,0,s,2*t.height),this.ctx.restore()}clear(){this.ctx.fillStyle="white",this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height)}}class p{constructor(t,e,i){this.touchPoint=null,this.swipeTimeout=250,this.onResize=()=>{this.update()},this.onMouseDown=t=>{if(this.checkTarget(t.target)){const e=this.getMousePos(t.clientX,t.clientY);this.app.startUserTouch(e),t.preventDefault()}},this.onTouchStart=t=>{if(this.checkTarget(t.target)&&t.changedTouches.length>0){const e=t.changedTouches[0],i=this.getMousePos(e.clientX,e.clientY);this.touchPoint={point:i,time:Date.now()},setTimeout(()=>{null!==this.touchPoint&&this.app.startUserTouch(i)},this.swipeTimeout),this.app.getSettings().mobileScrollSupport||t.preventDefault()}},this.onMouseUp=t=>{const e=this.getMousePos(t.clientX,t.clientY);this.app.userStop(e)},this.onMouseMove=t=>{const e=this.getMousePos(t.clientX,t.clientY);this.app.userMove(e,!1)},this.onTouchMove=t=>{if(t.changedTouches.length>0){const e=t.changedTouches[0],i=this.getMousePos(e.clientX,e.clientY);this.app.getSettings().mobileScrollSupport?(null!==this.touchPoint&&(Math.abs(this.touchPoint.point.x-i.x)>10||"read"!==this.app.getState())&&t.cancelable&&this.app.userMove(i,!0),"read"!==this.app.getState()&&t.preventDefault()):this.app.userMove(i,!0)}},this.onTouchEnd=t=>{if(t.changedTouches.length>0){const e=t.changedTouches[0],i=this.getMousePos(e.clientX,e.clientY);let s=!1;if(null!==this.touchPoint){const t=i.x-this.touchPoint.point.x,e=Math.abs(i.y-this.touchPoint.point.y);Math.abs(t)>this.swipeDistance&&e<2*this.swipeDistance&&Date.now()-this.touchPoint.time<this.swipeTimeout&&(t>0?this.app.flipPrev(this.touchPoint.point.y<this.app.getRender().getRect().height/2?"top":"bottom"):this.app.flipNext(this.touchPoint.point.y<this.app.getRender().getRect().height/2?"top":"bottom"),s=!0),this.touchPoint=null}this.app.userStop(i,s)}},this.parentElement=t,t.classList.add("stf__parent"),t.insertAdjacentHTML("afterbegin",'<div class="stf__wrapper"></div>'),this.wrapper=t.querySelector(".stf__wrapper"),this.app=e;const s=this.app.getSettings().usePortrait?1:2;t.style.minWidth=i.minWidth*s+"px",t.style.minHeight=i.minHeight+"px","fixed"===i.size&&(t.style.minWidth=i.width*s+"px",t.style.minHeight=i.height+"px"),i.autoSize&&(t.style.width="100%",t.style.maxWidth=2*i.maxWidth+"px"),t.style.display="block",window.addEventListener("resize",this.onResize,!1),this.swipeDistance=i.swipeDistance}destroy(){this.app.getSettings().useMouseEvents&&this.removeHandlers(),this.distElement.remove(),this.wrapper.remove()}getDistElement(){return this.distElement}getWrapper(){return this.wrapper}setOrientationStyle(t){this.wrapper.classList.remove("--portrait","--landscape"),"portrait"===t?(this.app.getSettings().autoSize&&(this.wrapper.style.paddingBottom=this.app.getSettings().height/this.app.getSettings().width*100+"%"),this.wrapper.classList.add("--portrait")):(this.app.getSettings().autoSize&&(this.wrapper.style.paddingBottom=this.app.getSettings().height/(2*this.app.getSettings().width)*100+"%"),this.wrapper.classList.add("--landscape")),this.update()}removeHandlers(){window.removeEventListener("resize",this.onResize),this.distElement.removeEventListener("mousedown",this.onMouseDown),this.distElement.removeEventListener("touchstart",this.onTouchStart),window.removeEventListener("mousemove",this.onMouseMove),window.removeEventListener("touchmove",this.onTouchMove),window.removeEventListener("mouseup",this.onMouseUp),window.removeEventListener("touchend",this.onTouchEnd)}setHandlers(){window.addEventListener("resize",this.onResize,!1),this.app.getSettings().useMouseEvents&&(this.distElement.addEventListener("mousedown",this.onMouseDown),this.distElement.addEventListener("touchstart",this.onTouchStart),window.addEventListener("mousemove",this.onMouseMove),window.addEventListener("touchmove",this.onTouchMove,{passive:!this.app.getSettings().mobileScrollSupport}),window.addEventListener("mouseup",this.onMouseUp),window.addEventListener("touchend",this.onTouchEnd))}getMousePos(t,e){const i=this.distElement.getBoundingClientRect();return{x:t-i.left,y:e-i.top}}checkTarget(t){return!this.app.getSettings().clickEventForward||!["a","button"].includes(t.tagName.toLowerCase())}}class c extends p{constructor(t,e,i,s){super(t,e,i),this.wrapper.insertAdjacentHTML("afterbegin",'<div class="stf__block"></div>'),this.distElement=t.querySelector(".stf__block"),this.items=s;for(const t of s)this.distElement.appendChild(t);this.setHandlers()}clear(){for(const t of this.items)this.parentElement.appendChild(t)}updateItems(t){this.removeHandlers(),this.distElement.innerHTML="";for(const e of t)this.distElement.appendChild(e);this.items=t,this.setHandlers()}update(){this.app.getRender().update()}}class u extends p{constructor(t,e,i){super(t,e,i),this.wrapper.innerHTML='<canvas class="stf__canvas"></canvas>',this.canvas=t.querySelectorAll("canvas")[0],this.distElement=this.canvas,this.resizeCanvas(),this.setHandlers()}resizeCanvas(){const t=getComputedStyle(this.canvas),e=parseInt(t.getPropertyValue("width"),10),i=parseInt(t.getPropertyValue("height"),10);this.canvas.width=e,this.canvas.height=i}getCanvas(){return this.canvas}update(){this.resizeCanvas(),this.app.getRender().update()}}class w extends l{constructor(t,e,i){super(t,e),this.outerShadow=null,this.innerShadow=null,this.hardShadow=null,this.hardInnerShadow=null,this.element=i,this.createShadows()}createShadows(){this.element.insertAdjacentHTML("beforeend",'<div class="stf__outerShadow"></div>\n             <div class="stf__innerShadow"></div>\n             <div class="stf__hardShadow"></div>\n             <div class="stf__hardInnerShadow"></div>'),this.outerShadow=this.element.querySelector(".stf__outerShadow"),this.innerShadow=this.element.querySelector(".stf__innerShadow"),this.hardShadow=this.element.querySelector(".stf__hardShadow"),this.hardInnerShadow=this.element.querySelector(".stf__hardInnerShadow")}clearShadow(){super.clearShadow(),this.outerShadow.style.cssText="display: none",this.innerShadow.style.cssText="display: none",this.hardShadow.style.cssText="display: none",this.hardInnerShadow.style.cssText="display: none"}reload(){this.element.querySelector(".stf__outerShadow")||this.createShadows()}drawHardInnerShadow(){const t=this.getRect(),e=this.shadow.progress>100?200-this.shadow.progress:this.shadow.progress;let i=(100-e)*(2.5*t.pageWidth)/100+20;i>t.pageWidth&&(i=t.pageWidth);let s=`\n            display: block;\n            z-index: ${(this.getSettings().startZIndex+5).toString(10)};\n            width: ${i}px;\n            height: ${t.height}px;\n            background: linear-gradient(to right,\n                rgba(0, 0, 0, ${this.shadow.opacity*e/100}) 5%,\n                rgba(0, 0, 0, 0) 100%);\n            left: ${t.left+t.width/2}px;\n            transform-origin: 0 0;\n        `;s+=0===this.getDirection()&&this.shadow.progress>100||1===this.getDirection()&&this.shadow.progress<=100?"transform: translate3d(0, 0, 0);":"transform: translate3d(0, 0, 0) rotateY(180deg);",this.hardInnerShadow.style.cssText=s}drawHardOuterShadow(){const t=this.getRect();let e=(100-(this.shadow.progress>100?200-this.shadow.progress:this.shadow.progress))*(2.5*t.pageWidth)/100+20;e>t.pageWidth&&(e=t.pageWidth);let i=`\n            display: block;\n            z-index: ${(this.getSettings().startZIndex+4).toString(10)};\n            width: ${e}px;\n            height: ${t.height}px;\n            background: linear-gradient(to left, rgba(0, 0, 0, ${this.shadow.opacity}) 5%, rgba(0, 0, 0, 0) 100%);\n            left: ${t.left+t.width/2}px;\n            transform-origin: 0 0;\n        `;i+=0===this.getDirection()&&this.shadow.progress>100||1===this.getDirection()&&this.shadow.progress<=100?"transform: translate3d(0, 0, 0) rotateY(180deg);":"transform: translate3d(0, 0, 0);",this.hardShadow.style.cssText=i}drawInnerShadow(){const t=this.getRect(),e=3*this.shadow.width/4,i=0===this.getDirection()?e:0,s=0===this.getDirection()?"to left":"to right",n=this.convertToGlobal(this.shadow.pos),r=this.shadow.angle+3*Math.PI/2,o=[this.pageRect.topLeft,this.pageRect.topRight,this.pageRect.bottomRight,this.pageRect.bottomLeft];let a="polygon( ";for(const t of o){let e=1===this.getDirection()?{x:-t.x+this.shadow.pos.x,y:t.y-this.shadow.pos.y}:{x:t.x-this.shadow.pos.x,y:t.y-this.shadow.pos.y};e=h.GetRotatedPoint(e,{x:i,y:100},r),a+=e.x+"px "+e.y+"px, "}a=a.slice(0,-2),a+=")";const g=`\n            display: block;\n            z-index: ${(this.getSettings().startZIndex+10).toString(10)};\n            width: ${e}px;\n            height: ${2*t.height}px;\n            background: linear-gradient(${s},\n                rgba(0, 0, 0, ${this.shadow.opacity}) 5%,\n                rgba(0, 0, 0, 0.05) 15%,\n                rgba(0, 0, 0, ${this.shadow.opacity}) 35%,\n                rgba(0, 0, 0, 0) 100%);\n            transform-origin: ${i}px 100px;\n            transform: translate3d(${n.x-i}px, ${n.y-100}px, 0) rotate(${r}rad);\n            clip-path: ${a};\n            -webkit-clip-path: ${a};\n        `;this.innerShadow.style.cssText=g}drawOuterShadow(){const t=this.getRect(),e=this.convertToGlobal({x:this.shadow.pos.x,y:this.shadow.pos.y}),i=this.shadow.angle+3*Math.PI/2,s=1===this.getDirection()?this.shadow.width:0,n=0===this.getDirection()?"to right":"to left",r=[{x:0,y:0},{x:t.pageWidth,y:0},{x:t.pageWidth,y:t.height},{x:0,y:t.height}];let o="polygon( ";for(const t of r)if(null!==t){let e=1===this.getDirection()?{x:-t.x+this.shadow.pos.x,y:t.y-this.shadow.pos.y}:{x:t.x-this.shadow.pos.x,y:t.y-this.shadow.pos.y};e=h.GetRotatedPoint(e,{x:s,y:100},i),o+=e.x+"px "+e.y+"px, "}o=o.slice(0,-2),o+=")";const a=`\n            display: block;\n            z-index: ${(this.getSettings().startZIndex+10).toString(10)};\n            width: ${this.shadow.width}px;\n            height: ${2*t.height}px;\n            background: linear-gradient(${n}, rgba(0, 0, 0, ${this.shadow.opacity}), rgba(0, 0, 0, 0));\n            transform-origin: ${s}px 100px;\n            transform: translate3d(${e.x-s}px, ${e.y-100}px, 0) rotate(${i}rad);\n            clip-path: ${o};\n            -webkit-clip-path: ${o};\n        `;this.outerShadow.style.cssText=a}drawLeftPage(){"portrait"!==this.orientation&&null!==this.leftPage&&(1===this.direction&&null!==this.flippingPage&&"hard"===this.flippingPage.getDrawingDensity()?(this.leftPage.getElement().style.zIndex=(this.getSettings().startZIndex+5).toString(10),this.leftPage.setHardDrawingAngle(180+this.flippingPage.getHardAngle()),this.leftPage.draw(this.flippingPage.getDrawingDensity())):this.leftPage.simpleDraw(0))}drawRightPage(){null!==this.rightPage&&(0===this.direction&&null!==this.flippingPage&&"hard"===this.flippingPage.getDrawingDensity()?(this.rightPage.getElement().style.zIndex=(this.getSettings().startZIndex+5).toString(10),this.rightPage.setHardDrawingAngle(180+this.flippingPage.getHardAngle()),this.rightPage.draw(this.flippingPage.getDrawingDensity())):this.rightPage.simpleDraw(1))}drawBottomPage(){if(null===this.bottomPage)return;const t=null!=this.flippingPage?this.flippingPage.getDrawingDensity():null;"portrait"===this.orientation&&1===this.direction||(this.bottomPage.getElement().style.zIndex=(this.getSettings().startZIndex+3).toString(10),this.bottomPage.draw(t))}drawFrame(){this.clear(),this.drawLeftPage(),this.drawRightPage(),this.drawBottomPage(),null!=this.flippingPage&&(this.flippingPage.getElement().style.zIndex=(this.getSettings().startZIndex+5).toString(10),this.flippingPage.draw()),null!=this.shadow&&null!==this.flippingPage&&("soft"===this.flippingPage.getDrawingDensity()?(this.drawOuterShadow(),this.drawInnerShadow()):(this.drawHardOuterShadow(),this.drawHardInnerShadow()))}clear(){for(const t of this.app.getPageCollection().getPages())t!==this.leftPage&&t!==this.rightPage&&t!==this.flippingPage&&t!==this.bottomPage&&(t.getElement().style.cssText="display: none"),t.getTemporaryCopy()!==this.flippingPage&&t.hideTemporaryCopy()}update(){super.update(),null!==this.rightPage&&this.rightPage.setOrientation(1),null!==this.leftPage&&this.leftPage.setOrientation(0)}}class x{constructor(){this._default={startPage:0,size:"fixed",width:0,height:0,minWidth:0,maxWidth:0,minHeight:0,maxHeight:0,drawShadow:!0,flippingTime:1e3,usePortrait:!0,startZIndex:0,autoSize:!0,maxShadowOpacity:1,showCover:!1,mobileScrollSupport:!0,swipeDistance:30,clickEventForward:!0,useMouseEvents:!0,showPageCorners:!0,disableFlipByClick:!1}}getSettings(t){const e=this._default;if(Object.assign(e,t),"stretch"!==e.size&&"fixed"!==e.size)throw new Error('Invalid size type. Available only "fixed" and "stretch" value');if(e.width<=0||e.height<=0)throw new Error("Invalid width or height");if(e.flippingTime<=0)throw new Error("Invalid flipping time");return"stretch"===e.size?(e.minWidth<=0&&(e.minWidth=100),e.maxWidth<e.minWidth&&(e.maxWidth=2e3),e.minHeight<=0&&(e.minHeight=100),e.maxHeight<e.minHeight&&(e.maxHeight=2e3)):(e.minWidth=e.width,e.maxWidth=e.width,e.minHeight=e.height,e.maxHeight=e.height),e}}!function(t,e){void 0===e&&(e={});var i=e.insertAt;if(t&&"undefined"!=typeof document){var s=document.head||document.getElementsByTagName("head")[0],n=document.createElement("style");n.type="text/css","top"===i&&s.firstChild?s.insertBefore(n,s.firstChild):s.appendChild(n),n.styleSheet?n.styleSheet.cssText=t:n.appendChild(document.createTextNode(t))}}(".stf__parent {\n  position: relative;\n  display: block;\n  box-sizing: border-box;\n  transform: translateZ(0);\n\n  -ms-touch-action: pan-y;\n  touch-action: pan-y;\n}\n\n.sft__wrapper {\n  position: relative;\n  width: 100%;\n  box-sizing: border-box;\n}\n\n.stf__parent canvas {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  left: 0;\n  top: 0;\n}\n\n.stf__block {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  box-sizing: border-box;\n  perspective: 2000px;\n}\n\n.stf__item {\n  display: none;\n  position: absolute;\n  transform-style: preserve-3d;\n}\n\n.stf__outerShadow {\n  position: absolute;\n  left: 0;\n  top: 0;\n}\n\n.stf__innerShadow {\n  position: absolute;\n  left: 0;\n  top: 0;\n}\n\n.stf__hardShadow {\n  position: absolute;\n  left: 0;\n  top: 0;\n}\n\n.stf__hardInnerShadow {\n  position: absolute;\n  left: 0;\n  top: 0;\n}");t.PageFlip=class extends class{constructor(){this.events=new Map}on(t,e){return this.events.has(t)?this.events.get(t).push(e):this.events.set(t,[e]),this}off(t){this.events.delete(t)}trigger(t,e,i=null){if(this.events.has(t))for(const s of this.events.get(t))s({data:i,object:e})}}{constructor(t,e){super(),this.isUserTouch=!1,this.isUserMove=!1,this.setting=null,this.pages=null,this.setting=(new x).getSettings(e),this.block=t}destroy(){this.ui.destroy(),this.block.remove()}update(){this.render.update(),this.pages.show()}loadFromImages(t){this.ui=new u(this.block,this,this.setting);const e=this.ui.getCanvas();this.render=new d(this,this.setting,e),this.flipController=new g(this.render,this),this.pages=new n(this,this.render,t),this.pages.load(),this.render.start(),this.pages.show(this.setting.startPage),setTimeout(()=>{this.ui.update(),this.trigger("init",this,{page:this.setting.startPage,mode:this.render.getOrientation()})},1)}loadFromHTML(t){this.ui=new c(this.block,this,this.setting,t),this.render=new w(this,this.setting,this.ui.getDistElement()),this.flipController=new g(this.render,this),this.pages=new o(this,this.render,this.ui.getDistElement(),t),this.pages.load(),this.render.start(),this.pages.show(this.setting.startPage),setTimeout(()=>{this.ui.update(),this.trigger("init",this,{page:this.setting.startPage,mode:this.render.getOrientation()})},1)}updateFromImages(t){const e=this.pages.getCurrentPageIndex();this.pages.destroy(),this.pages=new n(this,this.render,t),this.pages.load(),this.pages.show(e),this.trigger("update",this,{page:e,mode:this.render.getOrientation()})}updateFromHtml(t){const e=this.pages.getCurrentPageIndex();this.pages.destroy(),this.pages=new o(this,this.render,this.ui.getDistElement(),t),this.pages.load(),this.ui.updateItems(t),this.render.reload(),this.pages.show(e),this.trigger("update",this,{page:e,mode:this.render.getOrientation()})}clear(){this.pages.destroy(),this.ui.clear()}turnToPrevPage(){this.pages.showPrev()}turnToNextPage(){this.pages.showNext()}turnToPage(t){this.pages.show(t)}flipNext(t="top"){this.flipController.flipNext(t)}flipPrev(t="top"){this.flipController.flipPrev(t)}flip(t,e="top"){this.flipController.flipToPage(t,e)}updateState(t){this.trigger("changeState",this,t)}updatePageIndex(t){this.trigger("flip",this,t)}updateOrientation(t){this.ui.setOrientationStyle(t),this.update(),this.trigger("changeOrientation",this,t)}getPageCount(){return this.pages.getPageCount()}getCurrentPageIndex(){return this.pages.getCurrentPageIndex()}getPage(t){return this.pages.getPage(t)}getRender(){return this.render}getFlipController(){return this.flipController}getOrientation(){return this.render.getOrientation()}getBoundsRect(){return this.render.getRect()}getSettings(){return this.setting}getUI(){return this.ui}getState(){return this.flipController.getState()}getPageCollection(){return this.pages}startUserTouch(t){this.mousePosition=t,this.isUserTouch=!0,this.isUserMove=!1}userMove(t,e){this.isUserTouch||e||!this.setting.showPageCorners?this.isUserTouch&&h.GetDistanceBetweenTwoPoint(this.mousePosition,t)>5&&(this.isUserMove=!0,this.flipController.fold(t)):this.flipController.showCorner(t)}userStop(t,e=!1){this.isUserTouch&&(this.isUserTouch=!1,e||(this.isUserMove?this.flipController.stopMove():this.flipController.flip(t)))}},Object.defineProperty(t,"__esModule",{value:!0})}));

/* ---- end StPageFlip ---- */

/* ---- Manual booklet (page-flip instruction-manual viewer) ------------
 * Ported from the Vermin_Booklet.html prototype (see its own
 * INTEGRATION.md for the full pitfalls list this code works around --
 * summarized inline at each relevant spot below, but read that file
 * before changing the stacking/sizing/blank-leaf logic). Generalized
 * from the prototype's single hardcoded device to any device via
 * MANUAL_BOOKLETS[deviceId] (an array of {key, crop, label} page
 * descriptors, one per LOGICAL page) plus that device's own name/model
 * already in DEVICES.
 *
 * ONE VIEWER FOR EVERY SYSTEM (2026-10-17: "a unified viewer
 * that works with all the systems ... the same look and feel as the Game and
 * Watch ... use that engine that is already built"). The page-turn engine
 * (StPageFlip above, buildBook below) is unchanged; what changed is where the
 * pages come from:
 *   Game & Watch  scan JPEGs in the gnw-manual bucket, <device id>_<pages>.jpg
 *                 ('1' a single page, '2-3' a spread), byte-identical to the
 *                 base64 the site used to carry in booklets/<id>.json.
 *   Game Boy,     the scanned PDFs, AS IS, in gb-manual / gbc-manual, named
 *   Color         <cartridge SHA-1>.pdf like the box art. pdf.js (exact
 *                 version below, loaded only when a PDF manual opens) draws
 *                 each page into a picture the book shows, a few pages ahead of
 *                 the reader, never the whole manual at once.
 * Which games have a manual, and how many pages, comes from the small indexes
 * metadata/manuals/<system>.json, written by the manuals pipeline
 * (manuals.py: source -> upload named by hash ->
 * index -> sync). Tiles show the open-book badge only where an index lists the
 * game. Record: docs/UNIFIED-BUILD-PLAN.md, "Manuals for every system".
 * ---------------------------------------------------------------------- */

/* ------------------------------------------------------------ the indexes */
// One index per system (metadata/manuals/<system>.json, written by manuals.py); the Atari
// ones are wired with no manuals yet (2026-10-17), so a pipeline run is all it takes.
const MANUAL_SYSTEMS = ['gnw', 'gb', 'gbc', 'sgb', 'atari2600', 'atari5200', 'atari7800', 'lynx', 'nes'];   // sgb: 25 Oct; nes (NES, Famicom, Disk System): 1 Nov
window.CW_MANUAL_INDEX = window.CW_MANUAL_INDEX || {};
let _manualIndexPromise = null;

/* Loaded once per page, revalidated (no-cache) so a manual added by the
   pipeline shows on the next load with no version tag to bump. */
function loadManualIndex() {
  if (_manualIndexPromise) return _manualIndexPromise;
  _manualIndexPromise = Promise.all(MANUAL_SYSTEMS.map(s =>
    fetch('metadata/manuals/' + s + '.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
  )).then(list => {
    list.forEach((j, i) => { if (j && j.manuals) window.CW_MANUAL_INDEX[MANUAL_SYSTEMS[i]] = j; });
    // A PDF is read by pdf.js with fetch(), which a bucket must allow (its CORS
    // rule); an <img> needs no such rule, so the G&W scans always work. Until a
    // bucket answers, its games show no badge: a Manual button that can only
    // say "could not load" would be a dead feature. One HEAD request per bucket.
    return Promise.all(MANUAL_SYSTEMS.map(s => {
      const j = window.CW_MANUAL_INDEX[s];
      if (!j || j.format !== 'pdf') return null;
      const k = Object.keys(j.manuals)[0];
      if (!k) { j.reachable = false; return null; }
      // An index may name an older bucket as 'alt' (gb-manual, replaced by gb-manuals on
      // 2026-10-17): it is used only while the new bucket does not answer.
      const head = b => fetch(b + '/' + k + '.pdf', { method: 'HEAD', mode: 'cors', cache: 'no-store' }).then(r => r.ok, () => false);
      return head(j.base)
        .then(ok => (ok || !j.alt) ? ok : head(j.alt).then(ok2 => { if (ok2) { j.usingAlt = true; j.base = j.alt; } return ok2; }))
        .then(ok => { j.reachable = ok; });
    }));
  }).then(() => {
    _groupManuals = null;
    try { sweepManualBadges(); } catch (e) { console.warn('[manuals] badge sweep failed', e); }
    try { document.dispatchEvent(new CustomEvent('cw:manuals-ready')); } catch (e) {}
    return window.CW_MANUAL_INDEX;
  });
  return _manualIndexPromise;
}

/* The SHA-1 the site has learned for a Game Boy tile: cws.js seeds it from the
   game server's listing, emby.js from the cartridge's own bytes. Re-read at
   most every few seconds (one parse, not one per tile). */
let _sha1Memo = null, _sha1MemoAt = 0;
function learnedSha1(id) {
  const now = Date.now();
  if (!_sha1Memo || now - _sha1MemoAt > 4000) {
    try { _sha1Memo = JSON.parse(localStorage.getItem('gnw.gb.cartSha1.v1') || '{}') || {}; } catch (e) { _sha1Memo = {}; }
    _sha1MemoAt = now;
  }
  return _sha1Memo[id] || null;
}

function deviceById(id) {
  try { if (typeof ALL_DEVICES !== 'undefined') return ALL_DEVICES.find(x => x && x.id === id) || null; } catch (e) {}
  return null;
}

/* A tile's own manual, by its id: the G&W index by device id, the Game Boy
   indexes by tile id (the pipeline's 'ids') or by the learned SHA-1. */
function ownManual(id) {
  const IDX = window.CW_MANUAL_INDEX;
  const g = IDX.gnw;
  if (g && g.manuals[id]) return { sys: 'gnw', key: id, pages: g.manuals[id].pages, base: g.base, format: 'jpg' };
  /* The Super Game Boy shelf: its tiles share their Game Boy copy's hash and ask the
     sgb index first; a Game Boy tile asks it last. */
  const sgb = String(id).indexOf('sgb-') === 0;
  const h1 = learnedSha1(sgb ? 'gb-' + String(id).slice(4) : id);
  const order = sgb ? ['sgb'].concat(MANUAL_SYSTEMS.filter(x => x !== 'sgb')) : MANUAL_SYSTEMS.filter(x => x !== 'sgb').concat(['sgb']);
  for (const s of order) {
    const j = IDX[s];
    if (!j || j.format !== 'pdf' || j.reachable !== true) continue;
    const h = (j.ids && j.ids[id]) || h1;
    const v = h && j.manuals[h];
    if (v) return { sys: s, key: h, pages: typeof v === 'object' ? v.n : v, shape: typeof v === 'object' ? v : null,
                    base: j.base, format: 'pdf', url: j.base + '/' + h + '.pdf', label: j.label || '' };
  }
  /* NES, Famicom and Disk System (1 Nov): the index lists tile ids (each group's representative, the id
     the covers and clips use), so a tile showing another version of the game asks with its representative's. */
  if (/^nes-x[0-9a-f]{12}$/.test(String(id)) && window.Variants && typeof window.Variants.repOf === 'function') {
    let r = null; try { r = window.Variants.repOf('nes', id); } catch (e) {}
    const rid = r ? 'nes-x' + String(r).slice(0, 12) : '';
    if (rid && rid !== id) return ownManual(rid);
  }
  return null;
}

/* A tile that stands for several versions (variants.js groups them) shows the
   manual any version has: the European release's booklet still explains the
   American cartridge. Built once per index load / catalogue size. */
let _groupManuals = null, _groupManualsLen = -1;
function groupManual(d) {
  const V = window.Variants;
  if (!V || typeof V.keyOf !== 'function' || typeof ALL_DEVICES === 'undefined') return null;
  if (!_groupManuals || _groupManualsLen !== ALL_DEVICES.length) {
    _groupManuals = new Map(); _groupManualsLen = ALL_DEVICES.length;
    for (const x of ALL_DEVICES) {
      if (!x || x.catalogue !== 'game-boy') continue;
      const m = ownManual(x.id);
      if (!m) continue;
      let k = null; try { k = V.keyOf(x); } catch (e) {}
      if (k && !_groupManuals.has(k)) _groupManuals.set(k, m);
    }
  }
  let k = null; try { k = V.keyOf(d); } catch (e) {}
  return (k && _groupManuals.get(k)) || null;
}

/* The manual for a device (or id), or null. */
window.cwManualFor = function (dOrId) {
  const d = typeof dOrId === 'string' ? (deviceById(dOrId) || { id: dOrId }) : dOrId;
  if (!d || !d.id) return null;
  return ownManual(d.id) || (d.catalogue === 'game-boy' ? groupManual(d) : null);
};

/* Has a manual: the G&W booklets as before (their page labels live in
   MANUAL_BOOKLETS, so the badge needs no index to appear), every other system
   by the indexes. */
window.cwHasManual = function (dOrId) {
  const id = typeof dOrId === 'string' ? dOrId : (dOrId && dOrId.id);
  if (!id) return false;
  try { if (typeof MANUAL_BOOKLETS !== 'undefined' && MANUAL_BOOKLETS[id]) return true; } catch (e) {}
  return !!window.cwManualFor(dOrId);
};

/* The open book (2026-10-17: "the icon for the manual button on the
   tile should be updated to an open book"). One shape for the tile badge and
   the drawer's Manual button. */
window.CW_OPEN_BOOK_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5h6a4 4 0 0 1 4 4V21a3 3 0 0 0-3-3H2z"/><path d="M22 4.5h-6a4 4 0 0 0-4 4V21a3 3 0 0 1 3-3h7z"/></svg>';

window.cwManualBadgeHTML = function (d) {
  if (!window.cwHasManual(d)) return '';
  const id = String(d.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return `<div class="manual-badge" onclick="openManual('${id}', event)" role="button" tabindex="0" data-key-activate title="View the instruction manual" aria-label="View manual">${window.CW_OPEN_BOOK_SVG}</div>`;
};

/* Tiles drawn before the indexes arrived get their badge now. A badge sits
   after the Play badge (the CSS places it to its left: .play-badge ~ .manual-badge). */
function sweepManualBadges() {
  document.querySelectorAll('.device-card[data-id]').forEach(card => {
    if (card.querySelector(':scope > .manual-badge')) return;
    const id = card.dataset.id;
    if (!window.cwHasManual(id)) return;
    const html = window.cwManualBadgeHTML(deviceById(id) || { id });
    if (!html) return;
    const play = card.querySelector(':scope > .play-badge');
    if (play) play.insertAdjacentHTML('afterend', html);
    else card.insertAdjacentHTML('afterbegin', html);
  });
}
window.cwSweepManualBadges = sweepManualBadges;

/* Opens whatever manual a device has, in the booklet. False when it has none. */
window.openManualFor = function (d) {
  const m = window.cwManualFor(d);
  if (!m) return false;
  if (m.format === 'pdf') { window.openManualPdf(d, m); return true; }
  return false;   // G&W: openManual() hands MANUAL_BOOKLETS to openManualBooklet
};

// The index is small (about 110 KB for the Game Boy's thousand manuals) and
// the tiles need it to show their badges, so it is asked for straight away.
loadManualIndex();

/* ------------------------------------------------------------ G&W scans */
function gnwScanUrl(key) {
  // key = mbook_<device id>_p<digits> (MANUAL_BOOKLETS); the index names its file.
  const m = /^mbook_(.+)_(p\d+)$/.exec(key || '');
  const g = window.CW_MANUAL_INDEX.gnw;
  if (!m || !g) return '';
  const e = g.manuals[m[1]], pg = e && e.files[m[2]];
  return pg ? g.base + '/' + m[1] + '_' + pg + '.jpg' : '';
}
function manualImgSrc(key) { return gnwScanUrl(key); }
/* The first page's picture, for the drawer's picture strip. */
window.cwManualThumb = function (deviceId) {
  try {
    const pages = (typeof MANUAL_BOOKLETS !== 'undefined') && MANUAL_BOOKLETS[deviceId];
    return pages && pages[0] ? gnwScanUrl(pages[0].key) : '';
  } catch (e) { return ''; }
};

// Fetches ONE device's manual pages, once (subsequent opens of the same
// device reuse the resolved promise), with real progress. Since 2026-10-17
// the pages are the scan JPEGs in the gnw-manual bucket (they were base64 in
// booklets/<id>.json); they are all fetched before the book is built, as the
// JSON was, so every page is already there when it is turned to.
const _manualPagePromises = new Map();

function ensureManualPagesLoaded(deviceId, onProgress) {
  if (_manualPagePromises.has(deviceId)) return _manualPagePromises.get(deviceId);
  const p = (async () => {
    await loadManualIndex();
    const pages = (typeof MANUAL_BOOKLETS !== 'undefined' && MANUAL_BOOKLETS[deviceId]) || [];
    const urls = Array.from(new Set(pages.map(pg => gnwScanUrl(pg.key))));
    if (!urls.length || urls.some(u => !u)) throw new Error('no manual index entry for ' + deviceId);
    let done = 0;
    if (onProgress) onProgress(0, '0 of ' + urls.length + ' pages');
    await Promise.all(urls.map(u => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { done++; if (onProgress) onProgress(done / urls.length, done + ' of ' + urls.length + ' pages'); res(); };
      img.onerror = () => rej(new Error('page did not load: ' + u.replace(/^.*\//, '')));
      img.src = u;
    })));
  })();
  // A rejected load must not stay cached as "done", or the Manual button
  // would be dead for that device for the rest of the session.
  p.catch(() => _manualPagePromises.delete(deviceId));
  _manualPagePromises.set(deviceId, p);
  return p;
}

/* ------------------------------------------------------------ pdf.js */
/* Exact version, stored on the site in vendor/pdfjs-4.10.38/ (pdf.min.mjs,
   pdf.worker.min.mjs and its Apache-2.0 LICENSE, unmodified from the npm
   package pdfjs-dist 4.10.38, legacy/build), and loaded only when a PDF
   manual is opened. The legacy build runs on older browsers too (the TV).
   No cmaps or standard fonts are set, so pdf.js asks for none. The path is
   made absolute from this script's own address, because an import() made
   through Function would not resolve a relative one reliably. */
const PDFJS_VERSION = '4.10.38';
const PDFJS_BASE = new URL('vendor/pdfjs-' + PDFJS_VERSION + '/',
  (document.currentScript && document.currentScript.src) || document.baseURI).href;
let _pdfjsPromise = null;
function loadPdfJs() {
  if (!_pdfjsPromise) {
    // import() through Function, so an engine that cannot parse it still runs the rest of this file.
    _pdfjsPromise = (new Function('u', 'return import(u)'))(PDFJS_BASE + 'pdf.min.mjs').then(m => {
      m.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.mjs';
      return m;
    });
    _pdfjsPromise.catch(() => { _pdfjsPromise = null; });
  }
  return _pdfjsPromise;
}

(function () {
  let stageEl, bookEl = null, pageFlip = null;
  let currentPages = [];   // this open device's own MANUAL_BOOKLETS array (or the PDF's pages)
  let currentModel = '';

  // The open PDF manual, when one is open: its document, the pictures drawn so
  // far (page number -> blob URL) and a token that makes a stale render (the
  // reader moved on to another manual) drop its result.
  const pdf = { url: '', doc: null, task: null, urls: new Map(), busy: new Set(), token: 0, width: 0, at: 0 };

  // See INTEGRATION.md Pitfall #5: works around a real, open StPageFlip bug
  // (github.com/Nodlik/StPageFlip issue #49) -- padding the book with one
  // blank leaf before the front cover and after the back cover means every
  // transition, including opening/closing on a cover, is an ordinary
  // two-page turn, the only code path that behaves correctly.
  const blankBefore = { blank: true };
  const blankAfter = { blank: true };
  // A real, OPAQUE 1x1 PNG (color-matched to the page background) -- see the
  // blank-leaf comment in buildBook. Also stands in for a PDF page not drawn yet.
  const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOQkRT7DwAB6wFLlGYSeQAAAABJRU5ErkJggg==';

  // Single-page (not spread) dimensions of the "virtual page" StPageFlip
  // lays out. The prototype hardcoded these to Vermin's own scan ratio
  // (480x318 => a single page of 1.51 h/w); that's right for the ~2.2-4.0
  // wide interior spreads every Wide Screen/Multi Screen/Panorama scan
  // comes in, but the four Tabletop manuals (Snoopy SM-73, Popeye PG-74,
  // DK Jr CJ-71, Cement Factory CM-72) are printed on much squarer paper --
  // their spreads scan at ~1.40 w/h, i.e. a single page taller than it is
  // wide. Forcing those into Vermin's page box squeezed each half-spread
  // down to fit the width and left both pages looking duplicated/unreadable
  // (confirmed live). So the page box is derived per book from that title's
  // own first interior spread instead, with Vermin's numbers as the default
  // for anything that can't be measured. Height is what stays fixed
  // (BASE_H); width follows from the real ratio, so a squarer book gets a
  // narrower page rather than a squashed one.
  const BASE_H = 318, BASE_MINH = 186, BASE_MAXH = 517;
  const DEFAULT_PAGE_W = 480; // Vermin's own single-page width at BASE_H
  let pageW = DEFAULT_PAGE_W;
  // PDF manuals only (set by openManualPdf): the booklet page's own width/height.
  let pageAspect = 1.35;

  // spreadRatio = full spread width/height. One page is half that width, so
  // pageW = BASE_H * (spreadRatio / 2). Measured off the real decoded image
  // rather than declared per-title, so it can never drift from the scans.
  function measurePageWidth(pages) {
    const spread = pages.find(p => p.crop === 'left');
    if (!spread) return DEFAULT_PAGE_W;
    const src = manualImgSrc(spread.key);
    if (!src) return DEFAULT_PAGE_W;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) return resolve(DEFAULT_PAGE_W);
        resolve(BASE_H * ((img.naturalWidth / img.naturalHeight) / 2));
      };
      img.onerror = () => resolve(DEFAULT_PAGE_W);
      img.src = src;
    });
  }

  /* THE ROOM THE WINDOW GIVES THE PAGES (30 Oct 2026; the height part since 2026-10-17). The
     window is at most 92% of the VISIBLE height (index.html: 92dvh; 96% on a short screen;
     visualViewport here, because on Android Chrome 100vh is the height with the toolbar hidden,
     so a book sized from it ran off the bottom). What is left after the title bar, the
     Previous/Next row, the hint and the window's padding is the room for the book, and the
     stage's width is the room sideways. Measured, never assumed: the bars differ per screen. */
  function fitRoom() {
    const stageW = stageEl ? stageEl.clientWidth : 0;
    const visH = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    let availH = 0;
    if (windowEl && stageEl) {
      // A hidden bar (the hint on a short screen) costs nothing: its margins still read as set, so they are left out.
      const outer = el => { if (!el) return 0; const c = getComputedStyle(el); if (c.display === 'none') return 0; return el.offsetHeight + parseFloat(c.marginTop) + parseFloat(c.marginBottom); };
      const wc = getComputedStyle(windowEl);
      availH = Math.floor(visH * (visH <= 500 ? 0.96 : 0.92)) - outer(windowEl.querySelector('.manual-window-head')) - outer(windowEl.querySelector('.manual-controls'))
        - outer(windowEl.querySelector(':scope > footer')) - parseFloat(wc.paddingTop) - parseFloat(wc.paddingBottom) - parseFloat(wc.borderTopWidth) - parseFloat(wc.borderBottomWidth) - 6;
    }
    return { stageW, visH, availH };
  }
  /* LARGE: the scale at which the book is as big as the room allows, both pages whole, the
     pages' own shape kept (see buildBook). ALWAYS THE WHOLE SPREAD (31 Oct: "In Large mode the
     left pages of the booklet are dropped and no longer visible ... Large is supposed to fit the
     screen, not cut half the book to make it bigger"). On 30 Oct a screen taller than wide showed
     one page at a time in Large; that is gone: Large is the biggest size at which both pages of
     the spread fit, on every screen and either way up. The one-page code below stays for a
     future choice but is never chosen. */
  function fitLarge() {
    const r = fitRoom();
    if (!r.stageW || r.availH <= 40) return { eff: 2, onePage: false };
    const spread = Math.min(r.stageW / (2 * pageW), r.availH / BASE_H);
    return { eff: spread, onePage: false };
  }
  // The one-page book (Large on a tall screen): its pages, and its index against the two-page
  // book's (page i sits at index i there, after the blank leaf; here at its place among the
  // real pages).
  let onePage = false, shownPages = null;
  function toOne(spreadIdx) {
    if (!shownPages) return spreadIdx;
    const p = currentPages[spreadIdx - 1];
    const j = p ? shownPages.indexOf(p) : -1;
    return j >= 0 ? j : Math.min(shownPages.length - 1, Math.max(0, spreadIdx - 1));
  }
  function toSpread(oneIdx) {
    if (!shownPages) return oneIdx;
    const k = currentPages.indexOf(shownPages[oneIdx]);
    return k >= 0 ? k + 1 : oneIdx + 1;
  }
  // The open page as the two-page book counts it (what buildBook's startIndex expects).
  function currentSpreadIndex() {
    if (!pageFlip) return 0;
    const idx = pageFlip.getCurrentPageIndex();
    return onePage ? toSpread(idx) : idx;
  }
  // The dots under the book (or a "3 / 41" counter for a long one): one per view.
  function buildDots(n) {
    dotsWrap.innerHTML = '';
    dotEls = [];
    countEl = null;
    if (n <= MAX_DOTS) {
      for (let d = 0; d < n; d++) {
        const dot = document.createElement('div');
        dot.className = 'manual-dot';
        dotsWrap.appendChild(dot);
        dotEls.push(dot);
      }
    } else {
      countEl = document.createElement('span');
      countEl.className = 'manual-count';
      countEl.style.cssText = 'min-width:5.5em;text-align:center;font-variant-numeric:tabular-nums;color:var(--muted);font-size:.85rem;';
      countEl.textContent = '1 / ' + n;
      dotsWrap.appendChild(countEl);
    }
  }

  // Builds a fresh #manual-book + StPageFlip instance at the given zoom
  // scale (1 or 2). Also used for the very first open. StPageFlip has no
  // public "resize" call that actually re-measures its container -- the
  // book's min/max-width are baked into the DOM once at construction time
  // -- so growing it for a real 2x zoom, or switching to a different
  // device's manual, means tearing the instance down and rebuilding fresh
  // (INTEGRATION.md Pitfall #2).
  function buildBook(scale, startIndex) {
    if (pageFlip) {
      pageFlip.destroy(); // removes the old #manual-book (and its listeners) entirely
    }
    // Always construct against an un-scrollbarred stage. Left over from a
    // previous device/zoom, .is-scrollable's scrollbar would still be
    // occupying ~10px of stage width at the moment StPageFlip measures its
    // container -- and that measurement is permanent (Pitfall #2/#3). The
    // rAF below re-adds the class if this book actually needs it.
    if (stageEl) stageEl.classList.remove('is-scrollable');
    // The window's own width again (Large narrows it to a book that is shorter than wide, below).
    if (windowEl) windowEl.style.width = '';
    // A fresh book starts unmoved; updateStageScrolling() decides again whether it needs moving.
    resetPan();
    bookEl = document.createElement('div');
    bookEl.id = 'manual-book';
    stageEl.appendChild(bookEl);

    /* ONE PAGE AT A TIME ON A TALL SCREEN IN LARGE (30 Oct 2026, see the fit below): the book
       holds only the real pages then (no blank leaves, no blank filler before the back cover),
       so the first view is the front cover and the last the back cover. Decided before the
       pages are made, from the room the window has. */
    onePage = scale === 2 && fitLarge().onePage;
    shownPages = onePage ? currentPages.filter(p => !p.blank) : null;
    const domPages = onePage ? shownPages : [blankBefore].concat(currentPages, [blankAfter]);

    domPages.forEach((page) => {
      const div = document.createElement('div');

      if (page.blank) {
        div.className = 'manual-page blank';
        const blankImg = document.createElement('img');
        blankImg.className = 'manual-pageimg';
        // A real, OPAQUE 1x1 PNG (color-matched to the page background), not
        // an empty div and not a transparent one -- StPageFlip keeps the
        // outgoing spread's pages rendered underneath (lower z-index) for
        // the whole flip, only swapping them out once it completes, so this
        // "blank" leaf is what visually covers that stale content while
        // it's on top. Transparent would let the old page show straight
        // through, which looks exactly like a duplicated page.
        blankImg.src = BLANK_PNG;
        blankImg.draggable = false;
        blankImg.style.width = '100%';
        blankImg.style.height = '100%';
        blankImg.style.position = 'absolute';
        blankImg.style.left = '0';
        blankImg.style.top = '0';
        div.appendChild(blankImg);
        bookEl.appendChild(div);
        return;
      }

      div.className = 'manual-page';

      const img = document.createElement('img');
      img.className = 'manual-pageimg';
      if (page.pdf) {
        // A PDF page: its picture if drawn already, else the page colour until it is.
        img.src = (Math.abs(page.i - pdf.at) <= PDF_KEEP && pdf.urls.get(page.i)) || BLANK_PNG;
        img.dataset.pdfI = String(page.i);
      } else {
        img.src = manualImgSrc(page.key);
      }
      img.draggable = false;
      if (page.crop === 'full') {
        img.style.left = '50%';
        img.style.transform = 'translateX(-50%)';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = page.pdf ? 'contain' : 'cover';
        img.style.position = 'absolute';
      } else if (page.crop === 'left') {
        img.style.left = '0';
      } else {
        img.style.right = '0';
      }
      div.appendChild(img);

      const shade = document.createElement('div');
      shade.className = 'manual-page-shade';
      div.appendChild(shade);

      bookEl.appendChild(div);
    });

    // min/max width scale with this book's own page width (see pageW /
    // measurePageWidth above) so the same 0.58x-1.63x latitude the
    // prototype's hardcoded 280/780 gave Vermin's 480 applies to every
    // book's real page shape, rather than clamping a squarer Tabletop page
    // back out to Vermin's proportions.
    const minW = pageW * (280 / DEFAULT_PAGE_W);
    const maxW = pageW * (780 / DEFAULT_PAGE_W);

    // StPageFlip will not draw a spread narrower than 2 * minWidth, whatever
    // the container says -- `size: 'stretch'` stretches to the parent but
    // stops dead at that floor. On a phone the floor is wider than the stage
    // itself (measured: a 390px-wide window gives a 340px stage, and the
    // book still renders 566px = 2 x 283), so the stage overflows sideways,
    // updateStageScrolling flips it to .is-scrollable, and that boxes the
    // page in -- a dragged page can no longer swing out past the book's
    // edges, which is most of what makes it read as a real booklet. That was
    // fixed on desktop by scoping .is-scrollable to the doesn't-fit case;
    // mobile just never fits, so it was permanently in the clipped mode.
    //
    // So shrink the WHOLE book uniformly until the narrowest spread it is
    // willing to draw fits the stage. Uniform (one factor applied to all six
    // numbers) keeps every ratio and the min/max latitude intact -- a book
    // that merely fits, rather than a squashed one.
    //
    // Normal only, and only when it doesn't fit. Any viewport wide enough for the
    // floor (~560px+, i.e. every desktop and tablet) computes eff === scale and is
    // untouched. Large has its own fit (fitLarge, below).
    let eff = scale;
    const room = fitRoom();
    const stageW = room.stageW;
    if (scale === 1 && stageW) {
      const narrowest = 2 * minW * scale;
      if (narrowest > stageW) eff = scale * (stageW / narrowest);
    }
    // FIT THE HEIGHT TOO, ON EVERY SCREEN (2026-10-17; seen on a Galaxy Fold 5:
    // "The Game Boy manual opens showing the book half cut off at the bottom half").
    // What is left after the title bar, the Previous/Next row, the hint and the
    // window's padding (fitRoom) is the room for the book; at Normal the book is shrunk
    // until its tallest possible page fits. A screen with room to spare (any desktop)
    // computes no change.
    lastFit = { w: stageW, h: Math.round(room.visH) };
    if (scale === 1 && stageW) {
      // The engine stretches each page to min(half the stage, maxWidth), so the
      // tallest the book can be is that width at the page's own shape.
      const tallest = Math.min(stageW / 2, maxW * eff) * BASE_H / pageW;
      if (room.availH > 40 && tallest > room.availH) eff = Math.min(eff, room.availH * pageW / (maxW * BASE_H));
    }
    /* LARGE FITS THE SCREEN (30 Oct 2026, the request: "Large mode should be large, not just 2x. Normal
       mode is to fit the graphics area loaded, while Large is to fit the graphics to the screen
       as best as it can"; and "the pages ... should stay within the window and be above the
       controls ... The manual should fit, not scroll ... The whole thing should be shown").
       What it was: 2x was literally twice the prototype's size, whatever the screen: the book
       overflowed the stage, was moved under the finger, ran under the Previous/Next row and off
       the window's bottom, and on a phone was no bigger than Normal.
       Now the book is scaled, keeping the pages' own shape, to the largest size at which both
       pages are whole inside the room the window has (fitRoom): it fills the width or the
       height, whichever runs out first. The engine's floor and ceiling are set to that exact
       page width, so it draws neither bigger nor smaller. Both pages of the spread always show,
       a phone upright included (fitLarge, 31 Oct). */
    let large = null;
    if (scale === 2 && stageW) {
      large = fitLarge();
      eff = large.eff;
      // A book narrower than the window (its height ran out first): the window closes in on
      // it, so the pages sit in their own frame rather than in a wide empty one. Set before
      // the engine measures (Pitfall #3: a forced reflow makes the new width real now). A
      // narrower window can wrap the title or the hint onto another line and take some of the
      // height back, so the room is measured again and the book fitted to it (measured: nine
      // pixels lost that way on a 1440x900 desk).
      // Never narrower than the Normal window (index.html: min(94vw, 960px)): on a phone the
      // title and the buttons need that width, and a narrower window only wraps them.
      const chrome = windowEl ? windowEl.offsetWidth - stageW : 0;
      const floorW = Math.min(window.innerWidth * 0.94, 960);
      for (let pass = 0; pass < 3 && windowEl; pass++) {
        const bookW = (onePage ? 1 : 2) * pageW * eff;
        const winW = Math.max(floorW, Math.round(bookW + chrome));
        if (winW >= windowEl.offsetWidth - 1) break;
        windowEl.style.width = winW + 'px';
        void windowEl.offsetWidth;
        const r2 = fitRoom();
        const eff2 = Math.min(eff, r2.availH / BASE_H, (onePage ? 1 : 0.5) * r2.stageW / pageW);
        if (eff2 >= eff - 0.001) break;
        eff = eff2;
      }
    }

    pageFlip = new St.PageFlip(bookEl, {
      width: pageW * eff,
      height: BASE_H * eff,
      size: 'stretch',
      minWidth: large ? pageW * eff : minW * eff,
      maxWidth: large ? pageW * eff : maxW * eff,
      minHeight: BASE_MINH * eff,
      maxHeight: BASE_MAXH * eff,
      maxShadowOpacity: 0.5,
      showCover: false,
      // Always render as a two-page spread -- StPageFlip's own portrait/
      // landscape auto-switch (a live width measurement) can race the
      // browser's layout pass right after a zoom rebuild and collapse to a
      // single visible page (INTEGRATION.md Pitfall #4). The one exception is
      // Large's one-page layout, which wants exactly that: the book's box is
      // then capped to one page's width (below), so the switch cannot race.
      usePortrait: onePage,
      flippingTime: 900,
      mobileScrollSupport: false
    });
    buildDots(onePage ? shownPages.length : numStates);

    pageFlip.loadFromHTML(bookEl.querySelectorAll('.manual-page'));
    // The one-page book's box is one page wide (the engine's own cap is two pages, set as it
    // loads: a wider box made the wrapper taller than the page, and the page sat low in it).
    if (onePage) bookEl.style.maxWidth = (pageW * eff) + 'px';
    pageFlip.on('flip', updateManualUI);
    // A moved book shows each new spread from its top left, where reading starts.
    pageFlip.on('flip', () => {
      if (!pan.on) return;
      const L = panLimits();
      if (!L) return;
      easePan();
      setPan(L.x1, L.y1, L);
    });
    // StPageFlip settles its own orientation/bounds measurement
    // asynchronously (loadFromHTML defers part of its setup by one tick
    // before firing 'init') -- jumping to startIndex synchronously right
    // after loadFromHTML returns races that settle step.
    pageFlip.on('init', () => {
      // startIndex counts as the two-page book does (page i at index i); the one-page book
      // has no blank leaves, so the same page sits one index earlier (toOne).
      const at = onePage ? toOne(startIndex) : startIndex;
      if (at) pageFlip.turnToPage(at);
      updateManualUI();
    });

    // One more render update a couple of frames later self-corrects any
    // stale size StPageFlip's very first bounds measurement baked in
    // before the browser fully settled the layout from the CSS changes
    // just made (window/stage resizing for the zoom toggle).
    const flipAtSchedule = pageFlip;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (pageFlip === flipAtSchedule) {
          pageFlip.getRender().update();
          // First pass once that final render update has settled the real
          // size. The ResizeObserver below is what makes this robust rather
          // than a timing guess -- see its own comment.
          updateStageScrolling();
          if (stageResizeObs) {
            stageResizeObs.disconnect(); // bookEl is recreated every build
            stageResizeObs.observe(stageEl);
            stageResizeObs.observe(bookEl);
          }
        }
      });
    });
  }

  // The stage only becomes a scroll container when the built book genuinely
  // doesn't fit it -- see the .is-scrollable CSS for the full reasoning and
  // for what that trade costs. Everywhere else the stage stays
  // overflow:visible so a turning/dragged page can swing outside the book's
  // edges the way a real book does. Measured rather than hardcoded to "2x"
  // or "Tabletop": whether a book fits depends on its own page shape AND the
  // viewport, so a short window can push other titles over the line too.
  // Only worth scrolling once a MEANINGFUL slice of the page is out of
  // reach, because turning scrolling on costs the free-swinging page turn
  // (see the .is-scrollable CSS). Measured at 2x: a Tabletop title
  // overflows by ~500px and is genuinely unreadable without scrolling,
  // whereas a normal landscape title overflows by ~8px of StPageFlip's own
  // internal slack -- boxing the flip to recover 8px would be a bad trade.
  const OVERFLOW_SLACK_PX = 32;

  /* A BOOK BIGGER THAN THE STAGE IS MOVED, NOT SCROLLED (2026-10-24: "The
     2x size on GnW manuals sit inside the window unlike the 1x that allows me to change the
     page and drag it out of the window. I cannot do that with 2x. Also the manual is cut and
     partially hidden behind the window").
     What it was: a book that did not fit turned the stage into a scroll box
     (.is-scrollable: overflow auto on the stage, overflow hidden on the book). That boxed the
     page in (no turning page could leave the book), a drag could not move the page (only the
     thin scrollbars could, and wheel), and the centred scroll box put half of any sideways
     overflow at a negative scroll position no scrollbar can reach: on a phone at 2x the left
     ~390 px of the left page could never be seen.
     Now nothing clips the book. It is moved with a transform (the engine reads its position
     from getBoundingClientRect, so pointer maths stay right), within limits that let each
     edge of the pages reach the matching edge of the stage, so every part can be brought into
     view. Moving it: drag the page (mouse or finger), the wheel, or, when the page itself has
     the focus (a TV, keys, a pad), the arrows; an arrow that cannot move the page any further
     moves the focus on, as anywhere else. Turning it stays as at 1x: a drag that starts near
     a page's outer edge, a click or tap on a page, or Previous / Next. The window stops
     clipping at 2x (index.html .manual-window.zoomed), so a turning page swings out over the
     window as it does at 1x; the title bar and the button row are drawn above the moved book
     (.book-pans) so they always stay usable. */
  const pan = { on: false, x: 0, y: 0, drag: null };
  const PAN_KEY_STEP = 90;
  let footerEl = null, footerText = '';
  const PAN_HINT = 'Drag the page to move it. Drag near its outer edge, tap or click it, press Left or Right, or use the arrow buttons to turn the pages.';

  // Where the drawn pages may be moved to, as translate limits (px), measured from the
  // engine's own page rectangle (never mid-flip phantom boxes).
  function panLimits() {
    if (!pageFlip || !bookEl || !stageEl) return null;
    const blk = bookEl.querySelector('.stf__block');
    if (!blk) return null;
    let br;
    try { br = pageFlip.getBoundsRect(); } catch (e) { return null; }
    if (!br || !br.width || !br.height) return null;
    const b = blk.getBoundingClientRect(), s = stageEl.getBoundingClientRect();
    const sw = stageEl.clientWidth, sh = stageEl.clientHeight;
    // The pages' top left inside the stage with no move applied.
    const l = b.left - s.left - stageEl.clientLeft + br.left - pan.x;
    const t = b.top - s.top - stageEl.clientTop + br.top - pan.y;
    // An axis that overflows: from "right/bottom edge on the stage's" to "left/top edge on
    // the stage's". An axis that fits stays where the layout put it (centred / top).
    const fx = br.width <= sw, fy = br.height <= sh;
    return {
      x0: fx ? 0 : sw - l - br.width, x1: fx ? 0 : -l,
      y0: fy ? 0 : sh - t - br.height, y1: fy ? 0 : -t,
      overX: br.width - sw, overY: br.height - sh, left: l, top: t
    };
  }
  function applyPan() {
    if (!bookEl) return;
    // translate3d keeps the layer the engine's own translateZ(0) gave it.
    bookEl.style.transform = (pan.x || pan.y) ? 'translate3d(' + pan.x + 'px,' + pan.y + 'px,0)' : '';
  }
  // Moves the book (clamped). True when it actually moved.
  function setPan(x, y, L) {
    L = L || panLimits();
    if (!L) return false;
    const nx = Math.round(Math.min(L.x1, Math.max(L.x0, x)));
    const ny = Math.round(Math.min(L.y1, Math.max(L.y0, y)));
    if (nx === pan.x && ny === pan.y) return false;
    pan.x = nx; pan.y = ny;
    applyPan();
    return true;
  }
  // A short glide for moves the reader did not drag (keys, a new spread).
  let _panEaseTimer = 0;
  function easePan() {
    if (!bookEl) return;
    bookEl.style.transition = 'transform .14s ease-out';
    clearTimeout(_panEaseTimer);
    _panEaseTimer = setTimeout(() => { if (bookEl) bookEl.style.transition = ''; }, 180);
  }
  function setPanMode(on) {
    if (on === pan.on) return;
    pan.on = on;
    // The stage is never a focus target (30 Oct 2026, the request: "remove the ability to select it
    // with the keys and controllers"): no tabindex, no ring; the keys turn the pages instead
    // (cwManualTurn, nav.js). Since Large fits the screen, this mode is a fallback only.
    if (stageEl) stageEl.classList.toggle('is-panning', on);
    if (windowEl) windowEl.classList.toggle('book-pans', on);
    if (!footerEl && windowEl) { footerEl = windowEl.querySelector(':scope > footer'); footerText = footerEl ? footerEl.textContent : ''; }
    if (footerEl) footerEl.textContent = on ? PAN_HINT : footerText;
  }
  function resetPan() {
    pan.x = 0; pan.y = 0; pan.drag = null;
    if (stageEl) stageEl.classList.remove('is-grabbing');
    setPanMode(false);
  }

  function updateStageScrolling() {
    if (!stageEl) return;
    stageEl.classList.remove('is-scrollable');   // the old scroll-box mode, gone (see above)
    const L = panLimits();
    // Never for the one-page book (Large on a tall screen, 30 Oct 2026): it is fitted whole, and
    // the engine's bounds rectangle is a two-page one there (it would move the page off the window).
    const on = !onePage && !!L && Math.max(L.overX, L.overY) > OVERFLOW_SLACK_PX;
    if (!on) {
      if (pan.on || pan.x || pan.y) { pan.x = 0; pan.y = 0; applyPan(); }
      setPanMode(false);
      return;
    }
    if (!pan.on) {
      setPanMode(true);
      // First view of a book that does not fit: its top left corner, so reading starts
      // where a page starts. An axis that fits keeps the book where the layout put it.
      setPan(L.overX > 0 ? -L.left : pan.x, L.overY > 0 ? -L.top : pan.y, L);
    } else {
      setPan(pan.x, pan.y, L);   // the stage changed size: keep the move inside the new limits
    }
  }

  // Re-check whenever the stage or the book actually changes size. The
  // rAF pass above catches the normal case, but it's still a guess at when
  // layout has settled: closing one book and opening another in quick
  // succession was observed measuring while the stage was still sized to
  // the PREVIOUS book, latching the wrong answer with nothing to correct
  // it. This makes the decision self-correcting instead of timing-based,
  // and also covers window resizes, which nothing else here handles.
  // Deliberately observes only these two elements' own boxes -- a page turn
  // resizes StPageFlip's internals, not these, so flips don't retrigger it
  // (which matters: mid-flip measurements are full of phantom overflow).
  // The visible area changed (a turn of the phone, the browser's toolbar sliding in
  // or out): rebuild the book at the same page so it fits again, in either size
  // (Large fits the screen too since 30 Oct 2026).
  let lastFit = null, _refitTimer = 0;
  function refitSoon() {
    clearTimeout(_refitTimer);
    _refitTimer = setTimeout(() => {
      if (!overlay || !overlay.classList.contains('open') || !pageFlip || !lastFit) return;
      // Not while a manual is loading (its stage holds the progress bar, not a book): the pages
      // of the one being opened would be built early beside the bar, from placeholders.
      if (!bookEl || !bookEl.isConnected) return;
      const visH = Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight);
      // Large may have narrowed the window to the book: measure the room at the window's own width.
      const zoomed = windowEl.classList.contains('zoomed');
      const narrowed = zoomed ? windowEl.style.width : '';
      if (narrowed) { windowEl.style.width = ''; void windowEl.offsetWidth; }
      const same = Math.abs(visH - lastFit.h) < 12 && Math.abs(stageEl.clientWidth - lastFit.w) < 12;
      if (same) { if (narrowed) windowEl.style.width = narrowed; return; }
      buildBook(zoomed ? 2 : 1, currentSpreadIndex());
    }, 300);
  }
  window.addEventListener('resize', refitSoon);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refitSoon);

  const stageResizeObs = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => updateStageScrolling())
    : null;

  let overlay, windowEl, subtitleEl, titleEl, dotsWrap, prevBtn, nextBtn, zoom1Btn, zoom2Btn, closeBtn;
  let dotEls = [];
  let _focusNextOnce = false;
  let countEl = null;      // "3 / 41" in place of the dots when a book has too many to fit
  let numStates = 0;
  const MAX_DOTS = 16;

  function stateFromIndex(idx) { return Math.floor(idx / 2); }

  // The page-section label lives in the window's subtitle line, rebuilt on
  // every page turn.
  function updateManualUI() {
    const idx = pageFlip.getCurrentPageIndex();
    // One page at a time (Large on a tall screen): a view is one page, not a spread.
    const state = onePage ? Math.min(Math.max(idx, 0), shownPages.length - 1) : stateFromIndex(idx);
    const states = onePage ? shownPages.length : numStates;
    dotEls.forEach((dot, i) => dot.classList.toggle('active', i === state));
    if (countEl) countEl.textContent = (state + 1) + ' / ' + states;

    let section;
    if (onePage) {
      const p = shownPages[state];
      section = (p && p.label) || '';
    } else if (state === 0) {
      section = currentPages[0].label;
    } else if (state === numStates - 1) {
      section = currentPages[currentPages.length - 1].label;
    } else {
      const left = currentPages[2 * state - 1];
      const right = currentPages[2 * state];
      // Some spreads are one topic continued across two pages (e.g.
      // "Cautions" on both halves) rather than two distinct topics -- don't
      // repeat the label in that case (INTEGRATION.md Pitfall #7).
      if (left.blank && right) section = right.label;
      else if (!right || right.blank) section = left.label;
      else if (left.pdf && right.pdf) section = 'Pages ' + left.i + '\u2013' + right.i + ' of ' + currentPages.length;
      else if (!right) section = left.label;
      else section = left.label === right.label ? left.label : left.label + ' · ' + right.label;
    }
    subtitleEl.textContent = 'Instruction Manual · ' + currentModel + ' · ' + section;
    prevBtn.disabled = state <= 0;
    nextBtn.disabled = state >= states - 1;
    // A button that just went dead (first or last spread) must not strand the focus.
    const a = document.activeElement;
    // First time the book is ready: Next takes the focus, if keys.js parked it on the
    // close button (or nowhere) while the book was loading and Next was still disabled.
    if (_focusNextOnce && !nextBtn.disabled) {
      _focusNextOnce = false;
      if (!a || a === document.body || a === overlay || a === closeBtn || a === windowEl) nextBtn.focus({ preventScroll: true });
    } else if (a && a.disabled && (a === prevBtn || a === nextBtn)) (a === nextBtn ? prevBtn : nextBtn).focus({ preventScroll: true });
    else if (!a || a === document.body) { if (!nextBtn.disabled) nextBtn.focus({ preventScroll: true }); }
    // The PDF pages drawn around the reader are counted as the two-page book counts them.
    if (pdf.doc && currentPages.length && currentPages[0].pdf) renderAround(onePage ? toSpread(idx) : idx);
  }

  function setManualZoom(scale) {
    const isZoomed = windowEl.classList.contains('zoomed');
    if (scale === (isZoomed ? 2 : 1)) return;
    const idx = currentSpreadIndex();
    windowEl.classList.toggle('zoomed', scale === 2);
    zoom1Btn.classList.toggle('active', scale === 1);
    zoom2Btn.classList.toggle('active', scale === 2);
    // Pressed while the pages are still loading: the size is kept for the build to come
    // (finishOpen reads the .zoomed class); nothing to rebuild yet.
    if (!pageFlip) return;
    // Force the browser to apply the width/max-width change from the class
    // toggle above synchronously (INTEGRATION.md Pitfall #3) -- without
    // this, StPageFlip's first size measurement inside buildBook (also
    // synchronous, later in this same tick) can still see the OLD
    // pre-toggle dimensions.
    void windowEl.offsetWidth;
    buildBook(scale, idx);
  }

  // A manual can be opened either from a device tile (nothing behind it but
  // the collection grid) or from the already-open device slide-out (an
  // .overlay behind it, itself ~75% dark with its own blur(8px)). Stacking
  // this overlay's own ~75% dark layer on top of that one compounds to
  // ~94% -- solid black rather than a blurred backdrop, which is the bug
  // this whole dance exists to avoid.
  //
  // Only the dark background is the problem; blur compounds harmlessly. So
  // when something IS open behind us, we drop just our own background and
  // keep our blur (see .manual-overlay.stacked). The grid then ends up
  // dimmed by .75 either way -- by us from a tile, by the slide-out from
  // there -- so both entry points look the same, which was always the goal.
  //
  // The previous approach stripped the underlying overlay's backdrop
  // instead, and restored it on close. Same end state, but it snapped the
  // grid sharp for a frame and re-blurred it as this overlay faded in: a
  // visible unblur/reblur flash on every open. Changing nothing underneath
  // leaves no such transition to get wrong. index.html's #lightbox-overlay
  // does the same thing (it's always stacked, so it drops its background
  // unconditionally rather than needing this check).
  function markStacked() {
    const stacked = Array.from(document.querySelectorAll('.overlay.open')).some(el => el !== overlay);
    overlay.classList.toggle('stacked', stacked);
  }

  // Exposed on window because index.html's closeOverlay() hands off to it
  // for #manualOverlay -- the global Escape/route-change sweeps go through
  // closeOverlay(), and this modal needs its own teardown, not just having
  // .open stripped.
  window.closeManualBooklet = function closeManualBooklet() {
    if (!overlay) return; // never opened, nothing to tear down
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Left set until the next open recomputes it would be a stale answer if
    // the booklet were next opened from a different entry point.
    overlay.classList.remove('stacked');
    // A PDF manual gives its memory back on close (measured on a phone-size run:
    // an 80-page manual held about 130 MB until then); reopening it reads it again
    // in about a second. dropPdf also stops any page still being drawn.
    dropPdf();
  };
  const closeManualBooklet = window.closeManualBooklet;

  let _manualInit = false;
  function initManualDomRefs() {
    if (_manualInit) return;
    _manualInit = true;
    overlay = document.getElementById('manualOverlay');
    windowEl = overlay.querySelector('.manual-window');
    titleEl = document.getElementById('manualTitle');
    subtitleEl = document.getElementById('manualSubtitle');
    stageEl = document.getElementById('manualStage');
    dotsWrap = document.getElementById('manualDots');
    prevBtn = document.getElementById('manualPrevBtn');
    nextBtn = document.getElementById('manualNextBtn');
    zoom1Btn = document.getElementById('manualZoom1Btn');
    zoom2Btn = document.getElementById('manualZoom2Btn');
    closeBtn = document.getElementById('manualCloseBtn');

    prevBtn.addEventListener('click', () => pageFlip.flipPrev());
    nextBtn.addEventListener('click', () => pageFlip.flipNext());
    zoom1Btn.addEventListener('click', () => setManualZoom(1));
    zoom2Btn.addEventListener('click', () => setManualZoom(2));
    closeBtn.addEventListener('click', closeManualBooklet);

    // A TAP TURNS THE PAGE ON A TOUCH SCREEN, AS A CLICK DOES WITH A MOUSE (2026-10-17,
    // reported: "on a PC I can click to change pages and I cannot do that on my
    // phone"). StPageFlip only treats a touch as a press after 250 ms (its swipeTimeout),
    // so a quick tap did nothing; a swipe or a drag still turns the page as before. A
    // touch that ends within 250 ms, having moved less than 12 px, turns the page
    // towards the half of the book it landed on (right half: next, left half: back).
    // Longer presses are left to the engine, so a page never turns twice.
    let tap = null;
    stageEl.addEventListener('touchstart', (e) => {
      tap = null;
      if (!pageFlip || !bookEl || e.touches.length !== 1 || !bookEl.contains(e.target)) return;
      const t = e.touches[0];
      tap = { x: t.clientX, y: t.clientY, at: Date.now() };
    }, { passive: true });
    stageEl.addEventListener('touchmove', (e) => {
      if (!tap || !e.touches.length) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - tap.x) > 12 || Math.abs(t.clientY - tap.y) > 12) tap = null;
    }, { passive: true });
    stageEl.addEventListener('touchend', (e) => {
      const t0 = tap; tap = null;
      if (!t0 || !pageFlip || Date.now() - t0.at >= 250 || !e.changedTouches.length) return;
      const t = e.changedTouches[0];
      if (Math.abs(t.clientX - t0.x) > 12 || Math.abs(t.clientY - t0.y) > 12) return;
      if (typeof pageFlip.getState === 'function' && pageFlip.getState() !== 'read') return;
      const r = bookEl.getBoundingClientRect();
      if (t.clientX >= r.left + r.width / 2) { if (!nextBtn.disabled) pageFlip.flipNext(); }
      else if (!prevBtn.disabled) pageFlip.flipPrev();
    }, { passive: true });

    /* MOVING A BOOK THAT DOES NOT FIT (2026-10-24; see updateStageScrolling). Only
       while .is-panning is on; a book that fits is the engine's alone, exactly as before.
       A press near a page's outer edge (the engine's own corner size, the full height) still
       goes to the engine and turns the page; any other press moves the book. A press that
       does not move turns the page towards the half it landed on, as a click does at 1x.
       These listen in the capture phase on the stage, so the engine never sees a move-press. */
    function pageSpot(cx, cy) {
      const blk = bookEl && bookEl.querySelector('.stf__block');
      if (!blk || !pageFlip) return null;
      let br; try { br = pageFlip.getBoundsRect(); } catch (e) { return null; }
      const b = blk.getBoundingClientRect();
      const x = cx - b.left - br.left, y = cy - b.top - br.top;
      const inside = x >= 0 && y >= 0 && x <= br.width && y <= br.height;
      const s = Math.sqrt(br.pageWidth * br.pageWidth + br.height * br.height) / 5;
      return { inside, edge: inside && (x < s || x > br.width - s), right: x >= br.width / 2 };
    }
    function panStart(cx, cy, kind) {
      const sp = pageSpot(cx, cy);
      pan.drag = { sx: cx, sy: cy, ox: pan.x, oy: pan.y, moved: false, kind, onPage: !!(sp && sp.inside), right: !!(sp && sp.right) };
      stageEl.classList.add('is-grabbing');
    }
    function panMove(cx, cy) {
      const d = pan.drag;
      if (!d) return;
      const dx = cx - d.sx, dy = cy - d.sy;
      if (!d.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.moved = true;
      setPan(d.ox + dx, d.oy + dy);
    }
    function panEnd(turn) {
      const d = pan.drag;
      pan.drag = null;
      stageEl.classList.remove('is-grabbing');
      if (!turn || !d || d.moved || !d.onPage || !pageFlip) return;
      if (typeof pageFlip.getState === 'function' && pageFlip.getState() !== 'read') return;
      if (d.right) { if (!nextBtn.disabled) pageFlip.flipNext(); }
      else if (!prevBtn.disabled) pageFlip.flipPrev();
    }
    stageEl.addEventListener('mousedown', (e) => {
      if (!pan.on || e.button !== 0 || !pageFlip) return;
      const sp = pageSpot(e.clientX, e.clientY);
      if (sp && sp.edge) return;                       // the engine turns the page from here
      e.preventDefault(); e.stopPropagation();
      panStart(e.clientX, e.clientY, 'mouse');
    }, true);
    window.addEventListener('mousemove', (e) => {
      if (!pan.drag || pan.drag.kind !== 'mouse') return;
      e.stopPropagation();                             // no corner peel from the engine while moving
      panMove(e.clientX, e.clientY);
    }, true);
    window.addEventListener('mouseup', (e) => {
      if (!pan.drag || pan.drag.kind !== 'mouse') return;
      panEnd(true);
    }, true);
    stageEl.addEventListener('touchstart', (e) => {
      if (!pan.on || !pageFlip) return;
      if (e.touches.length !== 1) { if (pan.drag && pan.drag.kind === 'touch') panEnd(false); return; }
      const t = e.touches[0];
      const sp = pageSpot(t.clientX, t.clientY);
      if (sp && sp.edge) return;                       // the engine (and the tap rule above) as at 1x
      // preventDefault: no copied mouse events after the finger lifts (the engine's own
      // touchstart did this; without it a tap would turn the page twice).
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      panStart(t.clientX, t.clientY, 'touch');
    }, { capture: true, passive: false });
    window.addEventListener('touchmove', (e) => {
      if (!pan.drag || pan.drag.kind !== 'touch' || !e.touches.length) return;
      if (e.touches.length > 1) { panEnd(false); return; }
      e.stopPropagation();
      panMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { capture: true, passive: true });
    window.addEventListener('touchend', (e) => {
      if (!pan.drag || pan.drag.kind !== 'touch') return;
      panEnd(true);
    }, true);
    window.addEventListener('touchcancel', () => { if (pan.drag && pan.drag.kind === 'touch') panEnd(false); }, true);
    stageEl.addEventListener('wheel', (e) => {
      if (!pan.on || e.ctrlKey) return;
      let dx = e.deltaX, dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 32; dy *= 32; } else if (e.deltaMode === 2) { dx *= stageEl.clientWidth; dy *= stageEl.clientHeight; }
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      e.preventDefault();
      setPan(pan.x - dx, pan.y - dy);
    }, { passive: false });
    // (The stage took the focus and the arrows moved a book that did not fit, 24 to 30 Oct
    // 2026. Gone: the stage is never selected now, and Large fits the screen.)
    // The overlay clips (overflow hidden) but can still be scrolled by a focus call; a moved
    // book must never drag the whole window off with it.
    overlay.addEventListener('scroll', () => { if (overlay.scrollTop || overlay.scrollLeft) { overlay.scrollTop = 0; overlay.scrollLeft = 0; } });

    // Click-outside-to-close, but only when the press itself started on the
    // backdrop (INTEGRATION.md Pitfall #6) -- a page drag that starts on
    // the book and releases over the backdrop fires a synthetic click on
    // the overlay too, which would otherwise close the modal mid-drag.
    let pressStartedOnSelf = false;
    overlay.addEventListener('mousedown', (e) => { pressStartedOnSelf = (e.target === overlay); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && pressStartedOnSelf) closeManualBooklet();
      pressStartedOnSelf = false;
    });

    /* THE KEYS AND THE CONTROLLER (30 Oct 2026, the request: "Clicking Enter or A on the controller
       while the manual is actually selected should turn the page forward", and the booklet is
       never selected itself). Escape closes. Enter, or a pad's A (gamepad.js presses Enter at
       the focus), turns the page forward whenever the window is open and the focus is not on
       one of its buttons (a button pressed by Enter does its own job: Normal, Large, close,
       Previous, Next). Left and Right turn the pages (nav.js manualMove -> cwManualTurn; the
       D-pad presses the arrows), as do LB and RB (registered below). A click or a tap on a
       page still turns it, as before.
       (2026-10-17 to 30 Oct: the arrows only moved the focus between the buttons.) */
    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') { closeManualBooklet(); return; }
      if (e.key !== 'Enter' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return;
      const t = e.target && e.target.nodeType === 1 ? e.target : null;
      if (t && (t.closest('button, a[href], input, select, textarea, [role="button"]'))) return;   // the focused control's own Enter
      if (!cwManualTurn('right')) return;
      e.preventDefault();
      e.stopPropagation();
    });
    // Previous / next page on the pad's shoulder buttons while the manual is open. Scope 'pad'
    // is the first a pad button looks in (gamepad.js scopes()), so these win over the Content
    // page's system switch for as long as the window is open.
    const F = window.Actions;
    if (F && typeof F.register === 'function') {
      const open = () => !!(overlay && overlay.classList.contains('open') && pageFlip);
      try {
        F.register('manual.prev', { label: 'Instruction manual: previous page (also Left, or Enter on Previous)', group: 'Content page', scope: 'pad', keys: ['Pad:LB'], palette: false, when: open, run: () => cwManualTurn('left') });
        F.register('manual.next', { label: 'Instruction manual: next page (also Right, or Enter or A off its buttons)', group: 'Content page', scope: 'pad', keys: ['Pad:RB'], palette: false, when: open, run: () => cwManualTurn('right') });
      } catch (err) { console.warn('[manuals] pad actions:', err); }
    }
  }

  /* Turns a page with the keys or a pad: 'left' back, 'right' forward. True when the manual is
     open (even at its first or last page, where there is nothing to turn: the key is still the
     manual's, so nothing else moves). nav.js calls this for Left and Right. */
  function cwManualTurn(dir) {
    if (!overlay || !overlay.classList.contains('open') || !pageFlip) return false;
    if (typeof pageFlip.getState === 'function' && pageFlip.getState() !== 'read') return true;   // mid-turn: wait
    if (dir === 'left') { if (!prevBtn.disabled) pageFlip.flipPrev(); }
    else if (!nextBtn.disabled) pageFlip.flipNext();
    return true;
  }
  window.cwManualTurn = cwManualTurn;

  // Progress UI for the one genuine wait in this modal: fetching a device's
  // scans (1.6MB median) the first time its manual is opened, or pdf.js and
  // a PDF's first pages. Mounted into the stage, which buildBook() clears
  // before it measures anything (Pitfall #2), so this can't affect the
  // book's size.
  //
  // Returns {update, done, fail} rather than touching module state, so a
  // stale open (the user clicking through several manuals quickly) can simply
  // be ignored by its caller instead of racing the current one's UI.
  function showManualLoading(model) {
    const wrap = document.createElement('div');
    wrap.className = 'manual-loading';
    wrap.innerHTML =
      '<div class="manual-loading-bar"><div class="manual-loading-fill"></div></div>' +
      '<div class="manual-loading-stat">Connecting…</div>';
    stageEl.appendChild(wrap);
    const fill = wrap.querySelector('.manual-loading-fill');
    const stat = wrap.querySelector('.manual-loading-stat');
    const label = (suffix) => 'Instruction Manual · ' + model + ' · ' + suffix;

    return {
      // fraction may be null when the total is not known -- then all we can
      // honestly report is the text.
      update(fraction, text) {
        if (fraction === null) {
          stat.textContent = text || 'Loading…';
          subtitleEl.textContent = label('Loading…');
          return;
        }
        const pct = Math.min(99, Math.round(fraction * 100));
        fill.style.width = pct + '%';
        stat.textContent = pct + '%' + (text ? ' · ' + text : '');
        subtitleEl.textContent = label('Loading… ' + pct + '%');
      },
      done() { fill.style.width = '100%'; stat.textContent = 'Preparing pages…'; },
      fail(msg) { wrap.classList.add('failed'); stat.textContent = msg || 'Could not load this manual.'; }
    };
  }

  // Shared start of every open: title, backdrop, controls parked.
  function beginOpen(title, model, pages) {
    initManualDomRefs();
    titleEl.textContent = title;
    currentModel = model;
    currentPages = pages;
    numStates = Math.ceil((pages.length + 2) / 2);

    // Before .open, so the correct backdrop is in place on the very first
    // frame the overlay becomes visible.
    markStacked();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    subtitleEl.textContent = 'Instruction Manual · ' + model + ' · Loading…';
    stageEl.innerHTML = '';
    // Park the controls while there's no book behind them. Both are rebuilt
    // below once the real one exists. Without this they keep the PREVIOUS
    // device's dots and enabled arrows, still wired to a pageFlip whose DOM
    // was just cleared -- clicking Next there quietly drives a destroyed
    // book instead of doing nothing.
    dotsWrap.innerHTML = '';
    dotEls = [];
    countEl = null;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    _focusNextOnce = true;
  }

  // Shared end of every open: the book (buildBook makes the dots, or a page counter for a
  // long book, since they depend on the layout it chooses).
  function finishOpen() {
    stageEl.innerHTML = ''; // drop the loading UI before StPageFlip measures the stage
    buildBook(windowEl.classList.contains('zoomed') ? 2 : 1, 0);
  }

  // device = the DEVICES[] entry; pages = MANUAL_BOOKLETS[device.id].
  window.openManualBooklet = async function (device, pages) {
    beginOpen(device.name + ' · Game & Watch', device.model, pages);

    // Only this device's pages, and only the first time it's opened. A
    // cached device resolves in the same tick, so the progress UI below
    // never gets a chance to flash -- it's for the genuine first fetch.
    const progress = _manualPagePromises.has(device.id) ? null : showManualLoading(device.model);
    try {
      await ensureManualPagesLoaded(device.id, progress ? progress.update : null);
    } catch (e) {
      // Stale open? Then the newer one owns the UI -- say nothing.
      if (!overlay.classList.contains('open') || currentPages !== pages) return;
      if (progress) progress.fail();
      subtitleEl.textContent = 'Instruction Manual · ' + device.model + ' · Unavailable';
      console.warn('Manual for ' + device.id + ' could not be loaded:', e && e.message || e);
      return;
    }
    if (progress) progress.done();
    // Per-book page shape -- must be measured before buildBook(), since
    // StPageFlip bakes its dimensions in at construction (Pitfall #2).
    pageW = await measurePageWidth(pages);

    // A second device's manual can be opened (or the same one re-opened)
    // while a previous build is still settling -- the awaits above mean the
    // overlay could have been closed, or another device opened, by the time
    // we get here.
    if (!overlay.classList.contains('open') || currentPages !== pages) return;
    finishOpen();
  };

  /* ---------------------------------------------------------- PDF manuals */
  // The system's name for the subtitle line.
  function systemLabel(d, m) {
    if (m && m.label) return m.label;   // the index names its system (Game Boy, Atari 7800, ...)
    if ((d && d.sgb) || (m && m.sys === 'sgb')) return 'Super Game Boy';
    if (d && d.system === 'gbc') return 'Game Boy Color';
    if (m && m.sys === 'gbc') return 'Game Boy Color';
    if (m && m.sys === 'gb') return 'Game Boy';
    return '';
  }

  // Pictures are drawn this wide in device pixels: sharp at 2x zoom on a
  // high-density phone, capped so a page never costs more than it shows.
  function pdfRenderWidth() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    return Math.round(Math.min(1280, Math.max(800, pageW * 2 * dpr)));
  }

  function dropPdf() {
    pdf.token++;
    for (const u of pdf.urls.values()) { try { URL.revokeObjectURL(u); } catch (e) {} }
    pdf.urls.clear(); pdf.busy.clear();
    if (pdf.task) { try { pdf.task.destroy(); } catch (e) {} }
    pdf.task = null; pdf.doc = null; pdf.url = '';
  }

  // One booklet page (pages[i - 1]) drawn into a picture. A PDF page that holds
  // a two-page spread is drawn half at a time, so each turn is one real page.
  async function renderPdfPage(i, token) {
    const pg = currentPages[i - 1];
    if (!pg || !pg.pdf || pdf.urls.has(i) || pdf.busy.has(i) || !pdf.doc) return;
    pdf.busy.add(i);
    try {
      const page = await pdf.doc.getPage(pg.pdf);
      if (token !== pdf.token) return;
      const vp1 = page.getViewport({ scale: 1 });
      const srcW = pg.half ? vp1.width / 2 : vp1.width;
      const scale = pdf.width / srcW;
      const vp = page.getViewport({ scale, offsetX: pg.half === 'R' ? -srcW * scale : 0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(srcW * scale); canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.88));
      canvas.width = canvas.height = 0;   // give the pixels back now, not at GC
      try { page.cleanup(); } catch (e) {}
      if (token !== pdf.token || !blob) return;
      const url = URL.createObjectURL(blob);
      pdf.urls.set(i, url);
      if (bookEl && Math.abs(i - pdf.at) <= PDF_KEEP) bookEl.querySelectorAll('img[data-pdf-i="' + i + '"]').forEach(img => { img.src = url; });
    } catch (e) {
      if (token === pdf.token) console.warn('[manuals] page ' + i + ' could not be drawn:', e && e.message || e);
    } finally {
      pdf.busy.delete(i);
    }
  }

  // The open page(s) first, then the next few, then the one behind: a turn
  // always lands on pages already drawn. One page at a time, so the reader's
  // own page never waits behind ten others.
  // Only the pages near the reader hold a decoded picture; the rest keep their
  // small JPEG (pdf.urls) and show the page colour until they come near again.
  const PDF_KEEP = 6;
  function applyPdfWindow(at) {
    pdf.at = at;
    if (!bookEl) return;
    bookEl.querySelectorAll('img[data-pdf-i]').forEach(img => {
      const i = +img.dataset.pdfI, near = Math.abs(i - at) <= PDF_KEEP;
      const want = near ? (pdf.urls.get(i) || BLANK_PNG) : BLANK_PNG;
      if (img.src !== want) img.src = want;
    });
  }
  let _renderChain = Promise.resolve();
  // flipIdx = StPageFlip's current page index. One-up books have no blank
  // leaves (page i is index i - 1); two-up books have one before the cover.
  function renderAround(flipIdx) {
    const at = flipIdx;
    applyPdfWindow(at);
    const token = pdf.token, n = currentPages.length;
    const want = [0, 1, 2, 3, 4, 5, -1, -2].map(k => at + k).filter(p => p >= 1 && p <= n);
    _renderChain = _renderChain.then(async () => {
      for (const p of want) { if (token !== pdf.token) return; await renderPdfPage(p, token); }
    });
  }

  /* THE BOOKLET'S SHAPE COMES FROM THE MANUAL (2026-10-17, two tests).
     Survey of all 1,004 Game Boy PDFs: 641 hold one booklet page per PDF page
     (a Game Boy page is about 1.35 wide by 1 tall; 55 are square, 17 tall);
     310 hold two-page spreads on every PDF page, page 1 being the outside cover
     (back cover left, front cover right: 12 of 12 sampled); 53 hold spreads
     between single-page covers. The pipeline (manuals.py shape()) stores it in
     the index: p PDF pages, n booklet pages, a booklet page w/h, split 'outer'
     or [spread page numbers].
     A spread is cut into its two pages (the outside cover's right half is the
     front cover, its left half the back cover), and the book is then laid out
     EXACTLY like a Game & Watch booklet at the manual's own page shape: the
     closed front cover on the right, each turn lifting a page over to the left,
     the back cover alone on the left at the end ("they have a booklet on
     the right and the pages open to the left like a real book ... there needs
     to be enough room for both pages"). A short-lived one-page-per-view layout
     was withdrawn the same day. A booklet with an odd page count gets one blank
     page before the back cover, so the back cover still closes on the left. */
  const SPREAD_AT = 1.8;
  function pdfPagesFor(numPdf, sh) {
    const split = sh && sh.split, out = [];
    const add = (n, half) => out.push({ pdf: n, half, crop: 'full' });
    if (split === 'outer') {
      add(1, 'R');
      for (let n = 2; n <= numPdf; n++) { add(n, 'L'); add(n, 'R'); }
      if (numPdf >= 1) add(1, 'L');
    } else {
      const S = new Set(Array.isArray(split) ? split : []);
      for (let n = 1; n <= numPdf; n++) { if (S.has(n)) { add(n, 'L'); add(n, 'R'); } else add(n, ''); }
    }
    const N = out.length;
    out.forEach((p, k) => {
      p.i = k + 1;
      p.label = k === 0 ? 'Front cover' : (k === N - 1 && N > 2) ? 'Back cover' : 'Page ' + (k + 1) + ' of ' + N;
    });
    if (N > 2 && N % 2) out.splice(N - 1, 0, { blank: true, crop: 'full', label: '' });
    return out;
  }
  // The same rules as manuals.py shape(), from the PDF itself: used only when
  // the index has no shape for this file or names another page count.
  async function measurePdfShape(doc) {
    const asp = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const v = (await doc.getPage(n)).getViewport({ scale: 1 });
      asp.push(v.width / v.height);
    }
    const spread = [], pages = [];
    asp.forEach((a, k) => { if (a >= SPREAD_AT) { spread.push(k + 1); pages.push(a / 2, a / 2); } else pages.push(a); });
    const inner = (pages.length > 2 ? pages.slice(1, -1) : pages).slice().sort((x, y) => x - y);
    const a = inner[Math.floor(inner.length / 2)] || 1.35;
    const sh = { p: asp.length, n: pages.length, a };
    if (spread.length) sh.split = (spread.length === asp.length && asp.length > 1) ? 'outer' : spread;
    return sh;
  }
  function applyShape(pages, sh) {
    pageAspect = (sh && sh.a) || 1.35;
    pageW = BASE_H * pageAspect;   // the G&W book's own height, the manual's own width
    numStates = Math.ceil((pages.length + 2) / 2);
  }

  // device = the tile's device; m = cwManualFor(device) (a PDF manual).
  window.openManualPdf = async function (device, m) {
    const model = systemLabel(device, m);
    const name = (device && device.name) || 'Manual';
    // The index carries the booklet's shape, so the book is laid out before the PDF is read.
    let sh = (m.shape && typeof m.shape === 'object') ? m.shape : null;
    const pages = pdfPagesFor(sh ? sh.p : Math.max(1, m.pages | 0), sh);
    beginOpen(name, model, pages);
    applyShape(pages, sh);
    const progress = showManualLoading(model);
    try {
      progress.update(0.1, 'Reading the manual');
      const lib = await loadPdfJs();
      if (currentPages !== pages) return;
      if (pdf.url !== m.url) {
        dropPdf();
        pdf.url = m.url;
        // Only what is needed is fetched: R2 answers byte ranges, so opening a
        // ten-megabyte manual reads its first pages, not the whole file.
        pdf.task = lib.getDocument({ url: m.url, disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144 });
        pdf.doc = await pdf.task.promise;
      }
      if (currentPages !== pages || !overlay.classList.contains('open')) return;
      progress.update(0.6, 'Drawing the first pages');
      if (!sh || sh.p !== pdf.doc.numPages) {
        // The index is a quick lookup; the file is the authority.
        sh = await measurePdfShape(pdf.doc);
        if (currentPages !== pages || !overlay.classList.contains('open')) return;
        pages.splice(0, pages.length, ...pdfPagesFor(sh.p, sh));
        applyShape(pages, sh);
      }
      pdf.width = pdfRenderWidth();
      pdf.at = 1;
      await renderPdfPage(1, pdf.token);
      if (currentPages !== pages || !overlay.classList.contains('open')) return;
      progress.done();
    } catch (e) {
      if (currentPages !== pages || !overlay.classList.contains('open')) return;
      progress.fail();
      subtitleEl.textContent = 'Instruction Manual · ' + model + ' · Unavailable';
      console.warn('[manuals] PDF manual could not be opened:', e && e.message || e);
      return;
    }
    finishOpen();
  };
})();
