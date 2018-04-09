JX.install('PHUIXAutocomplete',{construct:function(){this._map={};this._datasources={};this._listNodes=[];this._resultMap={};},members:{_area:null,_active:false,_cursorHead:null,_cursorTail:null,_pixelHead:null,_pixelTail:null,_map:null,_datasource:null,_datasources:null,_value:null,_node:null,_echoNode:null,_listNode:null,_promptNode:null,_focus:null,_focusRef:null,_listNodes:null,_x:null,_y:null,_visible:false,_resultMap:null,setArea:function(area){this._area=area;return this;},addAutocomplete:function(code,spec){this._map[code]=spec;return this;},start:function(){var
area=this._area;JX.DOM.listen(area,'keypress',null,JX.bind(this,this._onkeypress));JX.DOM.listen(area,['click','keyup','keydown','keypress'],null,JX.bind(this,this._update));var
select=JX.bind(this,this._onselect);JX.DOM.listen(this._getNode(),'mousedown','typeahead-result',select);var
device=JX.bind(this,this._ondevice);JX.Stratcom.listen('phabricator-device-change',null,device);var
deactivate=JX.bind(this,this._deactivate);JX.DOM.listen(area,'blur',null,deactivate);},_getSpec:function(){return this._map[this._active];},_ondevice:function(){if(JX.Device.getDevice()!='desktop'){this._deactivate();}},_activate:function(code){if(JX.Device.getDevice()!='desktop'){return;}if(!this._map[code]){return;}var
area=this._area;var
range=JX.TextAreaUtils.getSelectionRange(area);var
head=range.start;var
prior;if(head>1){prior=area.value.substring(head-2,head-1);}else{prior='<start>';}switch(prior){case'<start>':case' ':case'\n':case'\t':case'(':case'-':case'.':case'|':case'>':case'!':break;default:return;}var
line=area.value.substring(0,head-1);line=line.split('\n');line=line[line.length-1];if(line.match(/^\s+$/)){return;}this._cursorHead=head;this._cursorTail=range.end;this._pixelHead=JX.TextAreaUtils.getPixelDimensions(area,range.start,range.end);var
spec=this._map[code];if(!this._datasources[code]){var
datasource=new
JX.TypeaheadOnDemandSource(spec.datasourceURI);datasource.listen('resultsready',JX.bind(this,this._onresults,code));datasource.setTransformer(JX.bind(this,this._transformresult));datasource.setSortHandler(JX.bind(datasource,JX.Prefab.sortHandler,{}));this._datasources[code]=datasource;}this._datasource=this._datasources[code];this._active=code;var
head_icon=new
JX.PHUIXIconView().setIcon(spec.headerIcon).getNode();var
head_text=spec.headerText;var
node=this._getPromptNode();JX.DOM.setContent(node,[head_icon,head_text]);},_transformresult:function(fields){var
map=JX.Prefab.transformDatasourceResults(fields);var
icon;if(map.icon){icon=new
JX.PHUIXIconView().setIcon(map.icon).getNode();}map.display=[icon,map.displayName];return map;},_deactivate:function(){var
node=this._getNode();JX.DOM.hide(node);this._active=false;this._visible=false;},_onkeypress:function(e){var
r=e.getRawEvent();if(r.metaKey||(r.ctrlKey&&!r.altKey)){return;}var
code=r.charCode;if(this._map[code]){setTimeout(JX.bind(this,this._activate,code),0);}},_onresults:function(code,nodes,value,partial){if(!partial){if(!this._resultMap[code]){this._resultMap[code]={};}var
hits=[];for(var
ii=0;ii<nodes.length;ii++){var
result=this._datasources[code].getResult(nodes[ii].rel);if(!result){hits=null;break;}if(!result.autocomplete||!result.autocomplete.length){hits=null;break;}hits.push(result.autocomplete);}if(hits!==null){this._resultMap[code][value]=hits;}}if(code!==this._active){return;}if(value!==this._value){return;}if(this._isTerminatedString(value)){if(this._hasUnrefinableResults(value)){this._deactivate();return;}}var
list=this._getListNode();JX.DOM.setContent(list,nodes);this._listNodes=nodes;var
old_ref=this._focusRef;this._clearFocus();for(var
ii=0;ii<nodes.length;ii++){if(nodes[ii].rel==old_ref){this._setFocus(ii);break;}}if(this._focus===null&&nodes.length){this._setFocus(0);}this._redraw();},_setFocus:function(idx){if(!this._listNodes[idx]){this._clearFocus();return false;}if(this._focus!==null){JX.DOM.alterClass(this._listNodes[this._focus],'focused',false);}this._focus=idx;this._focusRef=this._listNodes[idx].rel;JX.DOM.alterClass(this._listNodes[idx],'focused',true);return true;},_changeFocus:function(delta){if(this._focus===null){return false;}return this._setFocus(this._focus+delta);},_clearFocus:function(){this._focus=null;this._focusRef=null;},_onselect:function(e){if(!e.isNormalMouseEvent()){e.kill();return;}var
target=e.getNode('typeahead-result');for(var
ii=0;ii<this._listNodes.length;ii++){if(this._listNodes[ii]===target){this._setFocus(ii);this._autocomplete();break;}}this._deactivate();e.kill();},_getSuffixes:function(){return[' ',':',',',')'];},_getCancelCharacters:function(){return['#','@',',','!','?','{','}'];},_getTerminators:function(){return[' ',':',',','.','!','?'];},_getIgnoreList:function(){return this._map[this._active].ignore||[];},_isTerminatedString:function(string){var
terminators=this._getTerminators();for(var
ii=0;ii<terminators.length;ii++){var
term=terminators[ii];if(string.substring(string.length-term.length)==term){return true;}}return false;},_hasUnrefinableResults:function(query){if(!this._resultMap[this._active]){return false;}var
map=this._resultMap[this._active];for(var
ii=1;ii<query.length;ii++){var
prefix=query.substring(0,ii);if(map.hasOwnProperty(prefix)){var
results=map[prefix];if(!results.length){return true;}if(results.length==1){var
result=results[0].substring(1);if(query.length>=result.length){if(query.substring(0,result.length)===result){return true;}}}}}return false;},_trim:function(str){var
suffixes=this._getSuffixes();for(var
ii=0;ii<suffixes.length;ii++){if(str.substring(str.length-suffixes[ii].length)==suffixes[ii]){str=str.substring(0,str.length-suffixes[ii].length);}}return str;},_update:function(e){if(!this._active){return;}var
special=e.getSpecialKey();if(special=='esc'){this._deactivate();e.kill();return;}var
area=this._area;if(e.getType()=='keydown'){if(special=='up'||special=='down'){var
delta=(special=='up')?-1:+1;if(!this._changeFocus(delta)){this._deactivate();}e.kill();return;}}var
range=JX.TextAreaUtils.getSelectionRange(area);if(range.start<this._cursorHead){this._deactivate();return;}if(special=='tab'||special=='return'){var
r=e.getRawEvent();if(r.shiftKey&&special=='tab'){this._deactivate();return;}if(range.start==this._cursorHead){this._deactivate();return;}if(this._autocomplete()){this._deactivate();}e.kill();return;}var
margin;if(special=='right'){margin=0;}else{margin=1;}var
tail=this._cursorTail;if((range.start>tail+margin)||(range.end>tail+margin)){this._deactivate();return;}this._cursorTail=Math.max(this._cursorTail,range.end);var
text=area.value.substring(this._cursorHead,this._cursorTail);this._value=text;var
pixels=JX.TextAreaUtils.getPixelDimensions(area,range.start,range.end);var
x=this._pixelHead.start.x;var
y=Math.max(this._pixelHead.end.y,pixels.end.y)+24;if(text.length&&text[0]==' '){this._deactivate();return;}var
trim=this._trim(text);var
cancels=this._getCancelCharacters();for(var
ii=0;ii<cancels.length;ii++){if(trim.indexOf(cancels[ii])!==-1){this._deactivate();return;}}var
ignore=this._getIgnoreList();for(ii=0;ii<ignore.length;ii++){if(text.indexOf(ignore[ii])===0){this._deactivate();return;}}var
force;if(this._isTerminatedString(text)){if(this._hasUnrefinableResults(text)){this._deactivate();return;}force=true;}else{force=false;}this._datasource.didChange(trim,force);this._x=x;this._y=y;var
hint=trim;if(hint.length){this._visible=true;}else{hint=this._getSpec().hintText;}var
echo=this._getEchoNode();JX.DOM.setContent(echo,hint);this._redraw();},_redraw:function(){if(!this._visible){return;}var
node=this._getNode();JX.DOM.show(node);var
p=new
JX.Vector(this._x,this._y);var
s=JX.Vector.getScroll();var
v=JX.Vector.getViewport();var
option_height=30;var
extra_margin=24;if((s.y+v.y)<(p.y+(5*option_height)+extra_margin)){var
d=JX.Vector.getDim(node);p.y=p.y-d.y-36;}p.setPos(node);},_autocomplete:function(){if(this._focus===null){return false;}var
area=this._area;var
head=this._cursorHead;var
tail=this._cursorTail;var
text=area.value;var
ref=this._focusRef;var
result=this._datasource.getResult(ref);if(!result){return false;}ref=result.autocomplete;if(!ref||!ref.length){return false;}var
suffixes=this._getSuffixes();var
value=this._value;var
found_suffix=false;for(var
ii=0;ii<suffixes.length;ii++){var
last=value.substring(value.length-suffixes[ii].length);if(last==suffixes[ii]){ref+=suffixes[ii];found_suffix=true;break;}}if(!found_suffix){ref=ref+' ';}area.value=text.substring(0,head-1)+ref+text.substring(tail);var
end=head+ref.length;JX.TextAreaUtils.setSelectionRange(area,end,end);return true;},_getNode:function(){if(!this._node){var
head=this._getHeadNode();var
list=this._getListNode();this._node=JX.$N('div',{className:'phuix-autocomplete',style:{display:'none'}},[head,list]);JX.DOM.hide(this._node);document.body.appendChild(this._node);}return this._node;},_getHeadNode:function(){if(!this._headNode){this._headNode=JX.$N('div',{className:'phuix-autocomplete-head'},[this._getPromptNode(),this._getEchoNode()]);}return this._headNode;},_getPromptNode:function(){if(!this._promptNode){this._promptNode=JX.$N('span',{className:'phuix-autocomplete-prompt',});}return this._promptNode;},_getEchoNode:function(){if(!this._echoNode){this._echoNode=JX.$N('span',{className:'phuix-autocomplete-echo'});}return this._echoNode;},_getListNode:function(){if(!this._listNode){this._listNode=JX.$N('div',{className:'phuix-autocomplete-list'});}return this._listNode;}}});