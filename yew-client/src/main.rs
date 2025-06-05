use yew::prelude::*;

#[function_component(App)]
fn app() -> Html {
    html! {
    <>
        <h1>{ "Deployment Bingo" }</h1>
        <div>
            {"Logged in as: "}
        </div>
        <div>
        </div>
    </>
}
}

fn main() {
    yew::Renderer::<App>::new().render();
}