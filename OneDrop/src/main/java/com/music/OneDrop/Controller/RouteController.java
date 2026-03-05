package com.music.OneDrop.Controller;


import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class RouteController {

    // On attrape tout ce qui n'est pas une extension de fichier (ex: .js, .css, .png)
    // et on le renvoie vers index.html pour que React Router prenne le relais.
    @RequestMapping(value = "{path:[^\\.]*}")
    public String redirect() {
        return "forward:/index.html";
    }
}
