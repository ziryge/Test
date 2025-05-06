import unittest
from modules.llama_integration import generate_response

class TestLlamaIntegration(unittest.TestCase):
    def test_generate_response(self):
        prompt = "Bonjour, comment ça va ?"
        response = generate_response(prompt)
        self.assertIsInstance(response, str)
        self.assertGreater(len(response), 0)

if __name__ == '__main__':
    unittest.main()