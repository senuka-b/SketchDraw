class PageHandler {
    static loadContent(page) {
     fetch(page)
         .then(response => response.text())
         .then(data => {
             document.getElementById('root').innerHTML = data;
             // Optionally, reinitialize scripts or event listeners here
         })
         .catch(error => {
             console.error('Error loading content:', error);
         });
 }

}