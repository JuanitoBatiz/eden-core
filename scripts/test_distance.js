const apiKey = 'AIzaSyAsKcB8G-dpoEOhabY80QN2SLhUPoSCEe4';
const origin = '19.6997,-98.7628';
const destinations = ['San Pablo Ixquitlan, Estado de Mexico', 'San Pablo Balleza, Estado de Mexico'];

const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destinations.map(d => encodeURIComponent(d)).join('|')}&key=${apiKey}&mode=driving`;

fetch(url).then(r=>r.json()).then(d => {
  console.log(JSON.stringify(d, null, 2));
});
