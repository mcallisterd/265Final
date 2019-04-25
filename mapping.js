

function start(){
  d3.json("earth-seas-250m.geo.json")
    .then(
      function(data){
        graph(data);
    },
      function(err){
        console.log(err);
    });
}

function graph(data){
  var height = 500;
  var width = 500;

  var svg = d3.select("svg")
              .attr("height",height)
              .attr("width",width);

  var geoMagic = d3.geoPath()
                   .projection(d3.geoEquirectangular());

  console.log(data);

  var countries = svg.append("g")
                     .selectAll("g")
                     .data(data.geometries[0].coordinates)
                     .enter()
                     .append("g");
  countries.append("path")
           .attr("d",geoMagic)
           .attr("stroke","red");
}
