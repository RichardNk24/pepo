import { createRoutePulse } from "@pepo/utils/routePulse";
import { createFleetMotion } from "./demoFleet";
import { MAP_STYLE } from "./MapTypes";
import { VEHICLE_METRICS, type VehicleImageUrls } from "./vehicleMetrics";
const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
/** Shared renderer: browser iframe and Expo Go WebView use the same interaction model. */
export function googleMapDocument(
  key: string,
  nonce = "",
  images: VehicleImageUrls = {
    taxi: "/maps/assets/car-top.png",
    moto: "/maps/assets/moto-top.png",
  },
) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style nonce="${nonce}">html,body,#map{margin:0;width:100%;height:100%;background:#E5E9EC}#notice{position:absolute;top:85px;left:20px;right:20px;padding:14px;background:white;border-radius:12px;font:14px system-ui;color:#172111;display:none}</style></head><body><div id="map" aria-label="Carte Google Maps interactive"></div><div id="notice" role="alert"></div><script nonce="${nonce}">
  (function(){
    var map,state,ready=false,reported=false,lastCamera='',lastRoute='',line,casing,dot,arrow,circle,pickup,destination,driver,animation=0,cameraFrame=0,lastRecenter=0,lastFix=0;
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var endpointLabels=[], halo, stopMarkers=[], fleet=[],pulseLayers=[],pulse=null,pulseStarted=0,lastPulseFrame=0,resizeTimer=0,fleetMotion=null,fleetKey="",fleetAnimation=0,fleetSeconds=0,fleetLastTime=0,fleetCredit=null;
    // tsx/esbuild preserves nested function names through this helper when serializing.
    // The generated document must supply it because it runs outside the server module.
    var __name=function(fn,name){return Object.defineProperty(fn,'name',{value:name,configurable:true});};
    var createFleet=(${createFleetMotion.toString()});
    var createPulse=(${createRoutePulse.toString()});
    function stopPulse(){cancelAnimationFrame(animation);animation=0;if(halo)halo.setPath([]);pulseLayers.forEach(function(layer){layer.setPath([]);});}
    function startPulse(){stopPulse();if(!pulse||reduced||document.hidden||(state&&state.motionEnabled===false))return;pulseStarted=performance.now();lastPulseFrame=0;
      function tick(now){if(now-lastPulseFrame>=33){lastPulseFrame=now;var parts=pulse.frame(now-pulseStarted);if(!halo)halo=new google.maps.Polyline({map:map,strokeWeight:12,strokeColor:"#C8B109",strokeOpacity:0.15,clickable:false,zIndex:3});halo.setPath(parts.slice(18).reduce(function(out,p){return out.concat(p.points.map(ll));},[]));parts.forEach(function(part,i){if(!pulseLayers[i])pulseLayers[i]=new google.maps.Polyline({map:map,strokeWeight:5,strokeOpacity:1,clickable:false,zIndex:4});pulseLayers[i].setOptions({strokeColor:part.color});pulseLayers[i].setPath(part.points.map(ll));});}animation=requestAnimationFrame(tick);}animation=requestAnimationFrame(tick);
    }
    document.addEventListener('visibilitychange',function(){if(document.hidden){stopPulse();stopFleet();}else {startPulse();startFleet();}});
    var motionQuery=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
    if(motionQuery&&motionQuery.addEventListener)motionQuery.addEventListener('change',function(e){reduced=e.matches;startPulse();startFleet();});
    window.addEventListener('pagehide',function(){stopPulse();stopFleet();fleet.forEach(function(m){m.setMap(null);});cancelAnimationFrame(cameraFrame);clearTimeout(timer);clearTimeout(resizeTimer);});

    var vehicleMetrics=${json(VEHICLE_METRICS)},vehicleImages=${json(images)};
    function vehicleIcon(kind){var type=['taxi','suv','fourByFour','minibus','tricycle','truck','pickupTruck'].indexOf(kind)>=0?'taxi':'moto',m=vehicleMetrics[type],scale=m.displayHeight/m.cropHeight,w=m.cropWidth*scale,h=m.displayHeight;return {url:vehicleImages[type],scaledSize:new google.maps.Size(m.width*scale,m.height*scale),size:new google.maps.Size(w,h),origin:new google.maps.Point(m.x*scale,m.y*scale),anchor:new google.maps.Point(w/2,h/2)};}
    // DOM overlays allow the supplied PNG vehicles to rotate at intersections.
    function fleetMarker(kind){
      var overlay=new google.maps.OverlayView(),position=null,visible=false,angle=0,node;
      var type=['taxi','suv','fourByFour','minibus','tricycle','truck','pickupTruck'].indexOf(kind)>=0?'taxi':'moto',m=vehicleMetrics[type];
      var h=m.displayHeight,w=m.cropWidth*h/m.cropHeight;
      overlay.onAdd=function(){node=document.createElement('div');node.style.cssText='position:absolute;pointer-events:none;width:'+w+'px;height:'+h+'px;transform-origin:center;will-change:transform';node.setAttribute('aria-label','Véhicule de démonstration, non réservable');
        var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),img=document.createElementNS(ns,'image');svg.setAttribute('width',w);svg.setAttribute('height',h);svg.setAttribute('viewBox',[m.x,m.y,m.cropWidth,m.cropHeight].join(' '));img.setAttribute('href',vehicleImages[type]);img.setAttribute('width',m.width);img.setAttribute('height',m.height);svg.appendChild(img);node.appendChild(svg);overlay.getPanes().overlayLayer.appendChild(node);overlay.draw();};
      overlay.draw=function(){if(!node)return;node.style.display=visible&&position?'block':'none';if(!position)return;var pt=overlay.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(position.lat,position.lng));if(pt){node.style.left=pt.x+'px';node.style.top=pt.y+'px';node.style.transform='translate(-50%,-50%) rotate('+angle+'deg)';}};
      overlay.onRemove=function(){if(node)node.remove();node=null;};
      overlay.setVisible=function(v){visible=v;overlay.draw();};
      overlay.setTitle=function(v){title=v;if(node)node.textContent=v;};overlay.setPosition=function(p){position=p;overlay.draw();};
      overlay.setHeading=function(target,dt){var difference=(target-angle+540)%360-180;angle+=(Math.sign(difference)*Math.min(Math.abs(difference),160*dt));overlay.draw();};
      overlay.setMap(map);return overlay;
    }
    function renderFleet(dt){if(!fleetMotion)return;fleetMotion.frame(fleetSeconds).forEach(function(p,i){marker(fleet[i],p);fleet[i].setHeading(p.heading,dt);});}
    function stopFleet(){cancelAnimationFrame(fleetAnimation);fleetAnimation=0;fleetLastTime=0;}
    function startFleet(){stopFleet();if(!fleetMotion||reduced||document.hidden||(state&&state.motionEnabled===false))return;
      function tick(now){if(!fleetLastTime)fleetLastTime=now;var dt=Math.min(0.1,Math.max(0,(now-fleetLastTime)/1000));if(dt>=0.03){fleetSeconds+=dt;fleetLastTime=now;renderFleet(dt);}fleetAnimation=requestAnimationFrame(tick);}fleetAnimation=requestAnimationFrame(tick);
    }
    function updateFleet(s){var points=s.picking?[]:s.nearbyVehicles||[],key=JSON.stringify(points);if(!fleetCredit){fleetCredit=document.createElement("a");fleetCredit.href="https://www.openstreetmap.org/copyright";fleetCredit.target="_blank";fleetCredit.rel="noopener noreferrer";fleetCredit.textContent="Simulation · © OpenStreetMap";fleetCredit.style.cssText="position:absolute;bottom:26px;right:4px;background:rgba(255,255,255,.85);color:#555;font:9px system-ui;padding:2px 4px;border-radius:3px;text-decoration:none";document.body.appendChild(fleetCredit);}fleetCredit.style.display=points.some(function(p){return p.path&&p.path.length>1;})?"block":"none";if(key!==fleetKey){fleetKey=key;stopFleet();fleet.forEach(function(m){m.setMap(null);});fleet=points.map(function(p){return fleetMarker(p.kind);});fleetMotion=points.length?createFleet(points):null;renderFleet(1);startFleet();}else if(s.motionEnabled===false||reduced||document.hidden)stopFleet();else if(!fleetAnimation)startFleet();if(driver)driver.setIcon(vehicleIcon(s.driverVehicleKind));}
    function send(type,data){var m=JSON.stringify({pepoMap:true,type:type,data:data});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else if(window.parent!==window)window.parent.postMessage(m,'*');}
    function fail(message){document.getElementById('notice').textContent=message;document.getElementById('notice').style.display='block';send('error',message);}
    window.gm_authFailure=function(){fail('La clé Google Maps est refusée. Vérifiez les restrictions et les API activées.');};
    function ll(p){return {lat:p.latitude,lng:p.longitude};}
    function valid(p){return p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
    function smoothCenter(p){cancelAnimationFrame(cameraFrame);if(!valid(p))return;var a=map.getCenter(),b=ll(p),start=performance.now();if(!a||reduced){map.setCenter(b);return;}function frame(now){var t=Math.min(1,(now-start)/450),e=1-Math.pow(1-t,3);map.setCenter({lat:a.lat()+(b.lat-a.lat())*e,lng:a.lng()+(b.lng-a.lng())*e});if(t<1)cameraFrame=requestAnimationFrame(frame);}cameraFrame=requestAnimationFrame(frame);}
    function makeMarker(color,title,scale){return new google.maps.Marker({map:map,title:title,icon:{path:google.maps.SymbolPath.CIRCLE,scale:scale||8,fillColor:color,fillOpacity:1,strokeColor:'#fff',strokeWeight:3},zIndex:5});}
    function marker(m,p){m.setVisible(!!p);if(p)m.setPosition(ll(p));}
    function updateEndpointLabels(s){
      var enabled=s.routeLabels&&!s.picking&&s.destination;
      if(!enabled){endpointLabels.forEach(function(label){label.setVisible(false);});return;}
      if(!endpointLabels.length){[s.labels&&s.labels.pickup||'Départ',s.labels&&s.labels.destination||'Arrivée'].forEach(function(title,i){
        var overlay=new google.maps.OverlayView(),position=null,visible=false,node;
        var text,tip;
        overlay.onAdd=function(){
          node=document.createElement('div');node.setAttribute('data-pepo-endpoint',i?'destination':'pickup');
          node.style.cssText='position:absolute;pointer-events:none;white-space:nowrap;z-index:'+(i?202:201);
          text=document.createElement('div');text.textContent=title;
          text.style.cssText='padding:8px 12px;border-radius:12px;font:600 13px system-ui;background:#172111;color:'+(i?'#F7D549':'#ffffff')+';box-shadow:0 2px 7px rgba(0,0,0,.16)';
          tip=document.createElement('div');tip.style.cssText='position:absolute;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;transform:translateX(-50%)';
          node.appendChild(text);node.appendChild(tip);
          // floatPane is above polylines, animated route layers and vehicle markers.
          overlay.getPanes().floatPane.appendChild(node);overlay.draw();
        };
        overlay.draw=function(){if(!node)return;node.style.display='none';if(!visible||!position)return;
          var projection=overlay.getProjection();if(!projection)return;var latlng=new google.maps.LatLng(position.latitude,position.longitude);
          var pixel=projection.fromLatLngToDivPixel(latlng),screen=projection.fromLatLngToContainerPixel(latlng);
          var area=map.getDiv(),minY=(state&&state.cameraTopInset)||80,maxY=area.clientHeight-((state&&state.cameraBottomInset)||60)+40;
          if(!pixel||!screen||screen.y<minY||screen.y>maxY||screen.x<0||screen.x>area.clientWidth)return;
          node.style.display='block';
          var width=node.offsetWidth,height=node.offsetHeight;
          var left=Math.max(8,Math.min(area.clientWidth-width-8,screen.x-width/2));
          var low=screen.y-height-22<minY;
          if(i&&state&&valid(state.pickup)){var other=projection.fromLatLngToContainerPixel(new google.maps.LatLng(state.pickup.latitude,state.pickup.longitude));if(other&&Math.abs(other.x-screen.x)<width+16&&Math.abs(other.y-screen.y)<height+36)low=true;}
          if(low&&screen.y+height+22>maxY)low=false;
          node.style.left=(pixel.x+left-screen.x)+'px';
          node.style.top=(pixel.y+(low?22:-height-22))+'px';
          node.style.transform='none';
          // Clamping the bubble must not move the point indicated by its tip.
          tip.style.left=(screen.x-left)+'px';tip.style.top=low?'-7px':'100%';
          tip.style.borderTop=low?'0':'7px solid #172111';tip.style.borderBottom=low?'7px solid #172111':'0';
        };
        overlay.onRemove=function(){if(node)node.remove();node=null;text=null;tip=null;};
        overlay.setTitle=function(v){title=v;if(text)text.textContent=v;};overlay.setPosition=function(p){position=p;overlay.draw();};overlay.setVisible=function(v){visible=v;overlay.draw();};overlay.setMap(map);endpointLabels.push(overlay);
      });}
      endpointLabels.forEach(function(label,i){if(label.setTitle)label.setTitle(i?(s.labels&&s.labels.destination||'Arrivée'):(s.labels&&s.labels.pickup||'Départ'));label.setPosition(i?s.destination:s.pickup);label.setVisible(true);});
    }
    function distance(a,b){return Math.hypot(a.latitude-b.latitude,(a.longitude-b.longitude)*Math.cos((a.latitude+b.latitude)*Math.PI/360));}
    function draw(points){stopPulse();var ps=points.map(ll);casing.setPath(ps);line.setPath(ps);pulse=points.length>1?createPulse(points):null;startPulse();}
    function apply(s){var previousMotion=state&&state.motionEnabled;state=s;if(!ready)return;if(previousMotion!==s.motionEnabled){if(s.motionEnabled===false)stopPulse();else startPulse();}var a=s.pickup,b=s.destination,r=s.route,f=s.userPosition;var samePosition=valid(f)&&distance(a,f)*111195<=15;marker(pickup,s.picking||samePosition?null:a);marker(destination,s.picking?null:b);marker(driver,s.picking?null:s.driver);marker(dot,valid(f)?f:null);marker(arrow,valid(f)&&s.heading!=null?f:null);if(valid(f)){circle.setCenter(ll(f));circle.setRadius(Math.max(0,f.accuracy||0));circle.setVisible(true);dot.setOpacity(s.stale?0.45:1);arrow.setOpacity(s.stale?0.3:1);arrow.setIcon({path:'M -8,-13 L 0,-31 L 8,-13 L 0,-17 Z',fillColor:'#172111',fillOpacity:0.65,strokeWeight:0,rotation:s.heading||0,scale:1,anchor:new google.maps.Point(0,0)});}else circle.setVisible(false);
      (s.picking?[]:s.stops||[]).forEach(function(p,i){if(!stopMarkers[i])stopMarkers[i]=makeMarker('#9C8B07','Étape '+(i+1),7);marker(stopMarkers[i],p);});for(var j=(s.picking?0:(s.stops||[]).length);j<stopMarkers.length;j++)marker(stopMarkers[j],null);
      updateFleet(s);updateEndpointLabels(s);
      var routeKey=JSON.stringify(s.picking?[]:r&&r.points||[]);if(routeKey!==lastRoute){lastRoute=routeKey;draw(s.picking?[]:r&&r.points||[]);}
      var cameraKey=JSON.stringify([a.latitude,a.longitude,b&&b.latitude,b&&b.longitude,routeKey,s.picking,s.recenterKey||0,s.overviewKey||0,s.cameraTopInset||80,s.cameraBottomInset||60]);
      if(cameraKey!==lastCamera){var old=lastCamera;lastCamera=cameraKey;if((s.recenterKey||0)!==lastRecenter&&valid(f)){smoothCenter(f);map.setZoom(17);}else if(b&&!s.picking){var bounds=new google.maps.LatLngBounds();(r&&r.points&&r.points.length?r.points:[a,b]).forEach(function(p){bounds.extend(ll(p));});bounds.extend(ll(a));bounds.extend(ll(b));map.fitBounds(bounds,{top:s.cameraTopInset||80,left:45,right:45,bottom:s.cameraBottomInset||60});}else {smoothCenter(s.followUser&&valid(f)?f:a);if(!old)map.setZoom(17);}lastRecenter=s.recenterKey||0;}
      else if(s.followUser&&valid(f)&&lastFix!==f.timestamp)smoothCenter(f);
      lastFix=f&&f.timestamp;
    }
    window.pepoUpdate=function(s){if(s&&valid(s.pickup))apply(s);};
    window.addEventListener('message',function(e){if(e.source!==window.parent)return;try{var m=typeof e.data==='string'?JSON.parse(e.data):e.data;if(m&&m.pepoMapCommand==='update')window.pepoUpdate(m.data);}catch(ignore){}});
    window.pepoInit=function(){
      map=new google.maps.Map(document.getElementById('map'),{center:{lat:-11.664,lng:27.482},zoom:16,styles:${json(MAP_STYLE)},disableDefaultUI:true,gestureHandling:'greedy',clickableIcons:false,keyboardShortcuts:true,tilt:0,heading:0,mapTypeId:'roadmap'});
      pickup=makeMarker('#172111','Point de départ');destination=makeMarker('#F7D549','Destination',10);driver=makeMarker('#25634D','Conducteur',7);dot=makeMarker('#172111','Votre position GPS',8);arrow=makeMarker('#172111','Orientation du téléphone');circle=new google.maps.Circle({map:map,strokeColor:'#3478F6',strokeOpacity:0.15,strokeWeight:1,fillColor:'#3478F6',fillOpacity:0.08,clickable:false});casing=new google.maps.Polyline({map:map,strokeColor:'#fff',strokeOpacity:0.95,strokeWeight:9,clickable:false,zIndex:2});line=new google.maps.Polyline({map:map,strokeColor:'#000000',strokeWeight:5,clickable:false,zIndex:3});
      map.addListener('dragstart',function(){cancelAnimationFrame(cameraFrame);if(state)state.followUser=false;send('pan');send('move');});map.addListener('zoom_changed',function(){send('move');});map.addListener('idle',function(){var p=map.getCenter();send('idle',{latitude:p.lat(),longitude:p.lng()});});map.addListener('click',function(e){if(state&&state.picking&&e.latLng)smoothCenter({latitude:e.latLng.lat(),longitude:e.latLng.lng()});});map.addListener('tilesloaded',function(){if(!reported){reported=true;clearTimeout(timer);send('ready',true);}});ready=true;if(state)apply(state);if(window.ResizeObserver)new ResizeObserver(function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){if(state&&!state.followUser&&!state.picking){lastCamera="";apply(state);}},180);}).observe(document.getElementById("map"));
    };
    var timer=setTimeout(function(){if(!reported)fail('Google Maps ne répond pas. Vérifiez votre connexion Internet.');},18000);var script=document.createElement('script');script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(${json(key)})+'&language=fr&region=CD&loading=async&callback=pepoInit';script.async=true;script.onerror=function(){clearTimeout(timer);fail('Carte Google indisponible. Vérifiez votre connexion Internet.');};document.head.appendChild(script);
  })();
  </script></body></html>`;
}
