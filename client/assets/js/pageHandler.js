
import { init } from "./script.js";
export class PageHandler {

    static loadContent(page) {


        fetch(`/pages/${page}.html`)
            .then(response => response.text())
            .then(data => {
                document.getElementById('root').innerHTML = data;
                init(page);

            })
            .catch(error => {
                console.error('Error loading content:', error);
            });


    }

}