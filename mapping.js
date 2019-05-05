start();

function start(){
  var promise_pile  = [
    d3.json("africa_map.geo.json"),
    d3.csv("malaria_mort.csv"),
    d3.csv("aPop2016.csv"),
    d3.csv("washPer100.csv"),
    d3.json("cholera.json")];
  Promise.all(promise_pile)
         .then(
           function(data){
             var geoData = data[0];
             var malData = data[1];
             var popData = data[2];
             var wasData = data[3];
             var choData = data[4];

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

             choData.fact.forEach(function(event){
               var c = event.dim.COUNTRY;
               if(dictionary[c]){
                 var x = dictionary[c].cholera;
                 if(x){
                   x[event.dim.YEAR]=event.Value;
                 }
                 else{
                   dictionary[c].cholera = {};
                 }
               }
             })

             geoData.features.forEach(function(country){
               if(dictionary[country.properties.brk_name]){
                 country.properties.daters = dictionary[country.properties.brk_name];
                 country.properties.daters.Country = country.properties.brk_name;
               }
               else{
                 country.properties.daters= {Country:country.properties.brk_name};
               }
               console.log(country.properties.daters);
             })

             graph(geoData);
         },
           function(err){
             console.log(err);
         });
}

function graph(gData,mData){
  var height = 500;
  var width = 500;

  var svg = d3.select("svg")
              .attr("height",height)
              .attr("width",width);

  var projection = d3.geoBromley()
                     .translate([width/3,height/2])
                     .scale([350]);

  var geoMagic = d3.geoPath(projection);

  var knuck = d3.drag().on('drag',dragon);
  var truck = d3.zoom().on("zoom",zuma);
  function dragon(d){
      var head = projection.translate();
      head[0]+=d3.event.dx;
      head[1]+=d3.event.dy;
      projection.translate(head);
      svg.selectAll("path").attr("d",geoMagic);
  }

  function zuma(d){
    var tail = [d3.event.transform.x,d3.event.transform.y];
    var scala = d3.event.transform.k*2000;
    projection.translate(tail).scale(scala);
    svg.selectAll("path").attr("d",geoMagic);
  }

  var countries = svg.append("g")
                     .attr("id","pathHolder")
                     .call(truck)
                     .call(truck.transform,
                     d3.zoomIdentity
                       .translate(width/2,height/2)
                       .scale(.18)
                       .translate(-390,50));

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

   countries.append("rect")
            .attr("x",0)
            .attr("y",0)
            .attr("width",width)
            .attr("height",height)
            .attr("opacity",0)
            .attr("fill","white");
  malaria("svg.a",2017);
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

//years go 2010 to 2017
//units are pure deaths in that country from malaria in that year
function malaria(svgSelector,year){
  var countries = d3.select(svgSelector)
                    .select("g#pathHolder")
                    .selectAll("path");
  var data = attrOfSelection(countries,"malaria",year);
  var colorScale = scaleDealer(0,data);
  fillsBaby(countries,colorScale,"malaria",year);

  WASH("svg.a","all");
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

//removed allC parameter which was the country attrOfSelection
// and instead of selection and then .attr..., we did allC.attr...
//d3.select(svgName).select("g#pathHolder").selectAll("path")
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

//year is just 2016
//units are deaths per 100,000 in that country from WASH in 2016
//or overall deaths. For the former, the second attribute should be "all", o.w. "perH"
function WASH(svgSelector,allOrH){
  var countries = d3.select(svgSelector)
                    .select("g#pathHolder")
                    .selectAll("path");
  var data = attrOfSelection(countries,"wash",allOrH);
  var colorScale = scaleDealer(1,data);
  fillsBaby(countries,colorScale,"wash",allOrH);

  cholera(svgSelector,2000);
}

//valid years are in 2016-1960
function cholera(svgSelector,year){
  var countries = d3.select(svgSelector)
                    .select("g#pathHolder")
                    .selectAll("path");
  var data = attrOfSelection(countries,"cholera",year);
  var colorScale = scaleDealer(2,data);
  fillsBaby(countries,colorScale,"cholera",year);
}

function checkingSomething(){
  var countries = d3.select("path#Egypt")
                    .on("click",function(d){
                      console.log("I can click through the rectangle");
                      return 9;
                    });
  console.log(countries);
}
