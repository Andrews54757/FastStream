#![allow(non_snake_case)]
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Test {

}

#[wasm_bindgen]
impl Test {
    pub fn new() -> Self {
        Test {}
    }
    pub fn process(
        &mut self, 
        input1: &mut [f32], input2: &mut [f32], 
        output1: &mut [f32], output2: &mut [f32]
    ) -> bool {
        true
    }
}

