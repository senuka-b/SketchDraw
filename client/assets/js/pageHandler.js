
import { init } from "./script.js";
export class PageHandler {

    static loadContent(page, room) {


        fetch(`/pages/${page}.html`)
            .then(response => response.text())
            .then(data => {
                document.getElementById('root').innerHTML = data;
                init(page, room);


            })
            .catch(error => {
                console.error('Error loading content:', error);
            });


    }

}