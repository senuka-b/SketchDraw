
import { init } from "./script.js";
export class PageHandler {

    static loadContent(page) {

        page = `/pages/${page}.html`;

        fetch(page)
            .then(response => response.text())
            .then(data => {
                document.getElementById('root').innerHTML = data;
                init();

            })
            .catch(error => {
                console.error('Error loading content:', error);
            });


    }

}