'use strict'

const el = (str) => {
  if (str.startsWith('#'))
    return document.getElementById(str.slice(1));
  else if (str.startsWith('.'))
    return document.getElementsByClassName(str.slice(1));
}



el('#scanBTN').addEventListener('click', () => {
  let data = {
    ports: el('#ports').value.trim(),
    hosts: el('#hosts').value.trim(),
    wantTcp: el('#TCP').checked,
    wantUdp: el('#UDP').checked,
    wantIPV4: el('#IPv4').checked,
    wantIPV6: el('#IPv6').checked
  }
  console.log(data);
  
  postData(`http://localhost:3501/USSR`,data)
    
});

function postData(url = ``, data = {}){
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
        // 'Content-type': 'multipart/mixed; charset=UTF-8'
      },
      body:  JSON.stringify(data),
    })
    .then(response => {return response.text();})
    .then(data => {
      console.log((data));
      el('#output').innerHTML = (data)
      })
    .catch(error => console.error(error));
}