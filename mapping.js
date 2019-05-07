start();

function start(){
  var promise_pile  = [
    d3.json("africa_map.geo.json"),
    d3.csv("malaria_mort.csv"),
    d3.csv("aPop2016.csv"),
    d3.csv("washPer100.csv"),
    d3.json("cholera.json"),
    d3.csv("diarrhea1.csv"),
    d3.csv("diarrheaData.csv"),
    d3.csv("allTheWater.csv"),
    d3.csv("happy.csv"),
    d3.csv("ClimateAndCodes.csv")
  ];
  Promise.all(promise_pile)
         .then(
           function(data){
             var geoData = data[0];
             var malData = data[1];
             var popData = data[2];
             var wasData = data[3];
             var choData = data[4];
             var diaData = data[5];
             var d2aData = data[6];
             var watData = data[7];
             var hapData = data[8];
             var codData = data[9];

             var dictionary={};

             malData.forEach(function(place){
               dictionary[place.Country]={malaria:place};
             })

             popData.forEach(function(place){
               if(dictionary[place.Country]){
                 dictionary[place.Country].pop=place.pop;
               }
               else{
                 dictionary[place.Country]={pop:place.pop};
               }
             })

             wasData.forEach(function(place){
               dictionary[place.Country].wash=
                {
                  perH:place.perH,
                  all:Math.floor(place.perH*dictionary[place.Country].pop/100000)
                }
             })

             var fixCho = compactCholera(choData.fact,dictionary);
             fixCho.forEach(function(country){
               dictionary[country.Country].cholera=country;
             })

             diaData.forEach(function(country){
               var s = country.Country.trim();
               if(dictionary[s]){
                 var x= {perH15: country.perH, all15:Math.ceil(country.perH * dictionary[s].pop/100000)};
                 dictionary[s].dia = x;
               }
             })

             d2aData.forEach(function(line){
               var q=line.Country;
               if(dictionary[q]){
                 if(!dictionary[q].dia){dictionary[q].dia={};}
                 dictionary[q].dia.DALY = line.DALY;
                 dictionary[q].dia.perH16 = line.perH;
                 dictionary[q].dia.all16  = line.all;
               }
             })

//pop is in 1000s, GDP is current USD/person,  NRI is mm/year of #I don't get this one
//tWat is in 10^9 m^3/year, so is aWat, so is uWat, uWatPer is m^3 /person/year
//JMP is % of people with clean water. To make map look better, I transform this by
//subtracting from 100, to find % of people WITHOUT clean water
             var cleanedData = smoothWater(watData);
             cleanedData.lis.forEach(function(name){
               var soFar = dictionary[name];
               cleanedData[name].attrs.forEach(function(attribute){
                 soFar[attribute]=cleanedData[name][attribute];
               })
             })

             hapData.forEach(function(stat){
               if(dictionary[stat.Country.trim()]){
                 dictionary[stat.Country.trim()].happy=stat.Value;
               }
             })

             codData.forEach(function(stat){
               dictionary[stat.Country.trim()].code = stat.Code;
             })

             var queries = [];
             var cOrder = [];
             var qBase = "http://climatedataapi.worldbank.org/climateweb/rest/v1/country/annualavg/bccr_bcm2_0/pr/";
             geoData.features.forEach(function(country){
               var nomme = country.properties.brk_name;
               //console.log(nomme)
               if(dictionary[nomme]){
                 country.properties.daters = dictionary[nomme];
                 country.properties.daters.Country = nomme;
               }
               else{
                 country.properties.daters= {Country:nomme};
               }
               if(dictionary[nomme] && dictionary[nomme].code!="SSD"){
                 cOrder.push(nomme);
                 queries.push(d3.csv(qBase+"2020/2039/"+dictionary[nomme].code));
                 queries.push(d3.csv(qBase+"2040/2059/"+dictionary[nomme].code));
               }
             });
             Promise.all(queries)
                    .then(function(cliData){
               cliData.forEach(function(pair,i){
                 var belongs = Math.floor(i/2);
                 if(i%2 ==0){dictionary[cOrder[belongs]].projection={};}
                  var s=pair.columns[10];
                  dictionary[cOrder[belongs]].projection[2020+20*(i%2)]=s.slice(1,s.length-2);
               })
             });

             console.log(dictionary);
             graph(geoData,"a");

             d3.select("body")
               .datum(geoData);
         },
           function(err){
             console.log(err);
         });
}

function compactCholera(cholera,dict){
  var choFirst = {};
  var names = [];
  cholera.forEach(function(d){
    var temp = d.dim.COUNTRY;
    if(dict[temp]){
        if(choFirst[temp]){
          choFirst[temp][d.dim.YEAR]=d.Value;
        }
        else{
          names.push(temp);
          var m={}
          m[d.dim.YEAR]=d.Value;
          choFirst[temp]=m;
        }
    };
  });
  var choTwo = {};
  var base = 1960;
  names.forEach(function(nom){
    var c = choFirst[nom];
    [1,2,3,4,5].forEach(function(decade){
      var count = 0;
      var sum = 0;
      [0,1,2,3,4,5,6,7,8,9].forEach(function(year){
        if(c[base+10*decade+year]){
          count++;
          sum+=parseInt(c[base+10*decade+year]);
        }
      });
      if(!choTwo[nom]){
        choTwo[nom]={};
      }
      if(count!=0){choTwo[nom][base+decade*10]=10*Math.ceil(sum/count);}
      else{choTwo[nom][base+decade*10]=0;}
    })
  });
  return names.map(function(name){var x=choTwo[name]; x["Country"]=name;return x;});
}

function smoothWater(waterData){
  var varDict = {"Total population":"popTime","GDP per capita":"GDP",
   "Long-term average annual precipitation in depth":"rDep",
   "Number of people undernourished (3-year average)":"hunger",
   "Agricultural water withdrawal":"aWat","Total water withdrawal":"uWat",
   "Total water withdrawal per capita":"uWatper",
   "Total population with access to safe drinking-water (JMP)":"JMP",
   "Long-term average annual precipitation in volume":"rVol"};
  var countries = {};
  countries["lis"]=[];
  waterData.forEach(function(line){
    var c = line.Country;
    if(!countries[c]){
      countries[c]={};
      countries[c]["attrs"]=[];
      countries["lis"].push(c);
    }
    var v = varDict[line.Variable]
    if(!countries[c][v]){
      var t = {};
      t[line.Year]=line.Value;
      countries[c][v]=t;
      countries[c]["attrs"].push(v);
    }
    countries[c][v][line.Year]=line.Value;
  });
  countries.lis.forEach(function(country){
    var q= countries[country];
    q.attrs.forEach(function(dType){
      var vals = q[dType];
      var tens = {};
      var count=0;
      var sum=0;
      for(var i=1990;i<=2020;i++){
        if((i%5)==0 && i!=1990){
          if(count!=0){tens[i-5]=Math.ceil(sum/count);}
          else{tens[i-5]=0;}
          count=0; sum=0;
        }
        if(vals[i]){count++; sum+=parseInt(vals[i]);}
      }
      q[dType]=tens;
    })
  })
  return countries;
}

function graph(gData,className){
  var height = 500;
  var width = 500;

  var svg = d3.select("body")
              .append("svg")
              .attr("height",height)
              .attr("width",width)
              .attr("class",className);

  var projection = d3.geoBromley()
                     .translate([width/3,height/2])
                     .scale([350]);

  var geoMagic = d3.geoPath(projection);

  var knuck = d3.drag().on('drag',dragon);
  function dragon(d){
      var head = projection.translate();
      head[0]+=d3.event.dx;
      head[1]+=d3.event.dy;
      projection.translate(head);
      svg.selectAll("path").attr("d",geoMagic);
  }
  var truck = d3.zoom().on("zoom",zuma);

  function zuma(d){
    var tail = [d3.event.transform.x,d3.event.transform.y];
    var scala = d3.event.transform.k*2000;
    projection.translate(tail).scale(scala);
    svg.selectAll("path").attr("d",geoMagic);
  }
  var countries = svg.append("g")
                     .attr("id","pathHolder"+className)
                     .call(truck)
                     .call(truck.transform,
                     d3.zoomIdentity
                       .translate(width/2,height/2)
                       .scale(.18)
                       .translate(-590,50));
  countries.selectAll("path")
          .data(gData.features)
          .enter()
          .append("path")
          .attr("d",geoMagic)
          .attr("stroke","black")
          .attr("fill","none")
          .attr("id",function(d,i){
            return d["properties"]["brk_name"];
          });
          cholera("a",2010)
}

var functionary={
"Malaria":function malaria(className,year){
  theEarlOfWarwick(className,"malaria",lessIsMore(className,"malaria",year,0))
},
"WASH Deaths":function WASH(className,allOrH){
   theEarlOfWarwick(className,"wash",lessIsMore(className,"wash",year,1));
},
"Cholera Deaths":function cholera(className,year){
  theEarlOfWarwick(className,"cholera",lessIsMore(className,"cholera",year,2));
},
"Diarrhea Deaths":function dia(className,type){
  theEarlOfWarwick(className,"dia",lessIsMore(className,"dia",type,3));
},
"JMP":function JMP(className,year){
  theEarlOfWarwick(className,"JMP",lessIsMore(className,"JMP",year,4));
},
"Precipitation":function rain(className,year){
  theEarlOfWarwick(className,"rDep",lessIsMore(className,"rDep",year,5));
},
"GDP":function GDP(className,year){
  theEarlOfWarwick(className,"GDP",lessIsMore(className,"GDP",year,6));
},
"Number Malnourished":function hunger(className,year){
  theEarlOfWarwick(className,"hunger",lessIsMore(className,"hunger",year,7));
},
"Overall Water Use":function useable(className,year){
  theEarlOfWarwick(className,"uWatper",lessIsMore(className,"uWatper",year,9));
},
"Agr. Water Use":function agr(className,year){
  theEarlOfWarwick(className,"aWat",lessIsMore(className,"aWat",year,8));
},
"Happiness":function happy(className){
  theEarlOfWarwick(className,"happy",lessIsMore(className,"happy",10));
},
"Temperature":function temp(className,year){
  theEarlOfWarwick(className,"projection",lessIsMore(className,"projection",year,11));
}}

function synch(){

  var svgs = d3.selectAll("svg");
  console.log(svgs);
  var height = 500;
  var width = 500;
  var projection = d3.geoBromley()
                     .translate([width/3,height/2])
                     .scale([350]);
  var geoMagic = d3.geoPath(projection);
  var truck = d3.zoom().on("zoom",zuma);

  function zuma(d){
    var tail = [d3.event.transform.x,d3.event.transform.y];
    var scala = d3.event.transform.k*2000;
    projection.translate(tail).scale(scala);
    svgs.selectAll("path").attr("d",geoMagic);
  }
  console.log(svgs.selectAll("svg > g"))
  var countries = svgs.selectAll("svg > g")
                      .call(truck)
                      .call(truck.transform,
                       d3.zoomIdentity
                       .translate(width/2,height/2)
                       .scale(.18)
                       .translate(-590,50));
}

function makeOptionsBoxes(type,className){
  var container = d3.select("div.options")
                    .append("div")
                    .attr("class","smallHold")
                    .attr("id",type);
  container.append("p")
           .text(className);
   var dDrop = container.append("div")
           .attr("class","dataDrop"+type)
           .attr("id",'off')
           .on("click",function(){
             var dro=d3.selectAll("div.dropper"+type);
             if(d3.select(this).attr("id")==="on"){
               dro.style("display","none");
               d3.select(this).attr("id","off");
             }
             else{
               dro.style("display","block");
               d3.select(this).attr("id","on");
             }
           })
           .append("p")
           .text("Data Set");


  dDrop.selectAll("div")
       .data(["GDP","JMP","Cholera Deaths","Diarrhea Deaths"
       ,"Number Malnourished","Malaria","Temperature","Precipitation",
       "Overall Water Use","WASH Deaths","Happiness"])//"Agr. Water Use"
       .enter()
       .append("div")
       .attr("class","dropper"+type)
       .attr("id",type)
       .style("display","none")
       .on("click",function(d){
         updateDataRange(d,type);
         functionary[d](d3.select(this).attr("id"),d3.select("div.general").attr("id"));
       })
       .append("p")
       .text(function(d){return d;});
  container.append("div")
           .attr("class","dataRange"+type)
           .attr("id",'off')
           .on("click",function(){
             var dro=d3.selectAll("div.dropper2"+type);
             if(d3.select(this).attr("id")==="on"){
               dro.style("display","none");
               d3.select(this).attr("id","off");
             }
             else{
               dro.style("display","block");
               d3.select(this).attr("id","on");
             }
           })
           .append("p")
           .text("Data Range");

  container.append("div")
           .attr("class","giggle")
           .attr("id","on")
           .on("click",function(){
             var leg = d3.select("svg."+type).select("g#legend");
             if(d3.select(this).attr("id")==="on"){leg.attr("transform","translate(5000,0)"); d3.select(this).attr("id","off");}
             else{leg.attr("transform","translate(0,330)"); d3.select(this).attr("id","on");}
           })
           .append("p")
           .text("Toggle Legend");
}

function updateDataRange(dataType,svgName){
  var convert = {"GDP":"GDP","JMP":"JMP","Agr. Water Use":"aWat","Cholera Deaths":"cholera",
  "Diarrhea Deaths":"dia","Number Malnourished":"hunger","Malaria":"malaria",
  "Temperature":"projection","Precipitation":"rDep","Overall Water Use":"uWatper",
  "WASH Deaths":"wash","Happiness":"happy"}

  var data = d3.select("body").data()[0];
  var valid ={};
  data.features.forEach(function(country){
    if(country.properties.daters[convert[dataType]]){
    Object.getOwnPropertyNames(country.properties.daters[convert[dataType]])
          .forEach(function(val){
      valid[val]="Yeah";
    })}
  })
  var options = Object.getOwnPropertyNames(valid);
  d3.select("div.options").attr("id",convert[dataType]);
  d3.select("div.general").attr("id",options[0]);
  d3.select("div.dataRange"+svgName).selectAll("div").remove();

  d3.select("div.dataRange"+svgName)
    .selectAll("div")
    .data(options)
    .enter()
    .append("div")
    .attr("class","dropper2"+svgName)
    .style("display","none")
    .on("click",function(d){
      d3.select("div.general").attr("id",d);
      functionary[dataType](svgName,d);
    })
    .append("p")
    .text(function(d){return d;});
}

function addMap(){
  var ids = ["a","b","c","d","e","f"];
  var L = d3.selectAll("svg").nodes().length;

  graph(d3.select("body").data()[0],ids[L]);
  makeOptionsBoxes(ids[L],"Map "+(L+1).toString());
  cholera(ids[L],2010)
}

function attrOfSelection(selection,attr,otherAtt){
  var data =[];
  selection.attr("class",function(d){
    var x=d.properties.daters[attr];
    if(x){
      if(otherAtt){data.push(x[otherAtt]);}
      else{data.push(x);}
    }
    return null;
  });
  return data
}

function grabTheCountries(className){
  return d3.select("svg."+className)
           .select("g#pathHolder"+className)
           .selectAll("path");
}

function scaleDealer(index,data){
  var schemes = [
    d3.schemeBlues[9],d3.schemeReds[9],d3.schemeGreens[9],
    d3.schemeOranges[9],d3.schemePurples[9],d3.schemeBrBG[9],
    d3.schemePRGn[9],d3.schemePuOr[9],d3.schemeRdBu[9],d3.schemeRdGy[9],
    d3.schemeRdYlBu[9],d3.schemeRdYlGn[9]
  ];
  return d3.scaleQuantile().range(schemes[index]).domain(data);
  //d3.scaleSequential(d3.interpolateReds)
  //.domain([0,d3.max(data,function(d){return d;})]) no range.
}

function theEarlOfWarwick(className,dataType,scale){
  var svg= d3.select("svg."+className);
  svg.select("g#legend").remove();
  var owner = svg.append("g").attr("class",dataType).attr("id","legend").attr("transform","translate(0,330)");
  var boxValues = scale.quantiles().map(function(d){return Math.floor(d)});
  var betterNames = { "malaria":"Malaria","wash":"WASH","cholera":"Cholera","dia":"Diarrhea",
          "JMP":"JMP","rVol":"Rain Volume","GDP":"GDP", "rDep":"Rain Depth","happy":"Happiness",
           "uWat":"Water Use", "uWatper":"UWAT per capita", "projection":"Future Precipitation","aWat":"AWAT" ,"hunger":"Hunger"};
  owner.append("rect")
       .attr("x",0)
       .attr("y",0)
       .attr("width",100)
       .attr("height",170)
       .attr("fill","grey");
  var subG = owner.selectAll("g")
                  .data(boxValues)
                  .enter()
                  .append("g");
  subG.append("rect")
      .attr("x",10)
      .attr("y",function(d,i){return 5+15*i;})
      .attr("width",10)
      .attr("height",10)
      .attr("fill",function(d){return scale(d)});
  subG.append("text")
      .text(function(d){return d;})
      .attr("x",25)
      .attr("y",function(d,i){return 15+15*i});
  owner.append("text")
       .attr("x",2)
       .attr("y",140)
       .text("Thresholds for")
  owner.append("text")
       .attr("x",2)
       .attr("y",160)
       .text(betterNames[dataType]);
}

function fillsBaby(allC, color, attr, attr2){
    allC.attr("fill",function(d){
      var x=d.properties.daters[attr];
      if(x){
        if(attr2){
          if(x[attr2]){return color(x[attr2]);}
          else{return "white"}
        }
        else{return color(x);}
      }
      else{ return "white";}
    })
}

function lessIsMore(className,attr1,attr2,index){
  var countries = grabTheCountries(className);
  var data = attrOfSelection(countries,attr1,attr2);
  var colorScale = scaleDealer(index,data);
  fillsBaby(countries,colorScale,attr1,attr2);
  return colorScale;
}

//years go 2010 to 2017
//units are pure deaths in that country from malaria in that year
function malaria(className,year){
  theEarlOfWarwick(className,"malaria",lessIsMore(className,"malaria",year,0))
}

//year is just 2016
//units are deaths per 100,000 in that country from WASH in 2016
//or overall deaths. For the former, the second attribute should be "all", o.w. "perH"
function WASH(className,allOrH){
  theEarlOfWarwick(className,"wash",lessIsMore(className,"wash",year,1));
}

//valid years are in 2016-1960
function cholera(className,year){
  theEarlOfWarwick(className,"cholera",lessIsMore(className,"cholera",year,2));
}

//type is "all15","perH15", "all16","perH16", or "DALY"
function dia(className,type){
  theEarlOfWarwick(className,"dia",lessIsMore(className,"dia",year,3));
}

//for most water data, years are 1982-2017, in multiples of 5
function JMP(className,year){
  theEarlOfWarwick(className,"JMP",lessIsMore(className,"JMP",year,4));
}

//used to have option to do rVol or rDep, switching to just rDep
function rain(className,year){
  theEarlOfWarwick(className,"rDep",lessIsMore(className,"rDep",year,5));
}

function GDP(className,year){
  theEarlOfWarwick(className,"GDP",lessIsMore(className,"GDP",year,6));
}

function hunger(className,year){
  theEarlOfWarwick(className,"hunger",lessIsMore(className,"hunger",year,7));
}

//type is "uWat" or "uWatper". Switched this to default is uWatper
function useable(className,year){
  theEarlOfWarwick(className,"uWatper",lessIsMore(className,"uWatper",year,9));
}

function agr(className,year){
  theEarlOfWarwick(className,"aWat",lessIsMore(className,"aWat",year,8));
}

function happy(className){
  theEarlOfWarwick(className,"happy",lessIsMore(className,"happy",10));
}
//valid years are 2020 or 2040
function temp(className,year){
  theEarlOfWarwick(className,"projection",lessIsMore(className,"projection",year,11));
}
