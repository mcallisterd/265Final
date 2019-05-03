start();

function start(){
  var promise_pile  = [
    d3.json("africa_map.geo.json"),
    d3.csv("malaria_mort.csv")];
  Promise.all(promise_pile)
         .then(
           function(data){
             var geoData = data[0];
             var malData = data[1];

             var dictionary={};
             malData.forEach(function(place){
               dictionary[place.Country]=place;
             })

             geoData.features.forEach(function(country){
               country.properties.malaria = dictionary[country.properties.brk_name];
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
  malaria(2010)
}

function malaria(year){

  var countries = d3.select("g#pathHolder")
                    .selectAll("path");

  var colorScale = d3.scaleOrdinal(d3.schemeBlues[5])
                     .domain([0,10000]);

  countries.attr("fill",function(d){
    if(d.properties.malaria){
      return colorScale(d.properties.malaria[year]);
    }
      return "white";
  })
}
